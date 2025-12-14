import React, { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export default function Guide() {
  const { t } = useLanguage()
  const [selectedSection, setSelectedSection] = useState<string>('intro')
  const [compact, setCompact] = useState<boolean>(true)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth <= 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const breadcrumbStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: 'var(--color-muted)',
    marginBottom: '16px',
    padding: '12px 24px'
  }

  const guideData = {
    intro: {
      title: '🌟 ' + t('guide.menuIntro'),
      icon: '📜',
      content: [
        { subtitle: t('guide.intro.subtitle1'), text: t('guide.intro.text1') },
        { subtitle: t('guide.intro.subtitle2'), text: t('guide.intro.text2') },
        { subtitle: t('guide.intro.subtitle3'), text: t('guide.intro.text3') }
      ]
    },
    rules: {
      title: '⚔️ ' + t('guide.menuRules'),
      icon: '📖',
      content: [
        { subtitle: t('guide.rules.subtitle1'), text: t('guide.rules.text1') },
        { subtitle: t('guide.rules.subtitle2'), text: t('guide.rules.text2') },
        { subtitle: t('guide.rules.subtitle3'), text: t('guide.rules.text3') },
        { subtitle: t('guide.rules.subtitle4'), text: t('guide.rules.text4') }
      ]
    },
    tactics: {
      title: '🧠 ' + t('guide.menuTactics'),
      icon: '⚡',
      content: [
        { subtitle: t('guide.tactics.subtitle1'), text: t('guide.tactics.text1') },
        { subtitle: t('guide.tactics.subtitle2'), text: t('guide.tactics.text2') },
        { subtitle: t('guide.tactics.subtitle3'), text: t('guide.tactics.text3') },
        { subtitle: t('guide.tactics.subtitle4'), text: t('guide.tactics.text4') },
        { subtitle: t('guide.tactics.subtitle5'), text: t('guide.tactics.text5') }
      ]
    },
    modes: {
      title: '🏆 ' + t('guide.menuModes'),
      icon: '🎯',
      content: [
        { subtitle: t('guide.modes.subtitle1'), text: t('guide.modes.text1') },
        { subtitle: t('guide.modes.subtitle2'), text: t('guide.modes.text2') },
        { subtitle: t('guide.modes.subtitle3'), text: t('guide.modes.text3') },
        { subtitle: t('guide.modes.subtitle4'), text: t('guide.modes.text4') },
        { subtitle: t('guide.modes.subtitle5'), text: t('guide.modes.text5') }
      ]
    },
    progression: {
      title: '✨ ' + t('guide.menuProgression'),
      icon: '🌙',
      content: [
        { subtitle: t('guide.progression.subtitle1'), text: t('guide.progression.text1') },
        { subtitle: t('guide.progression.subtitle2'), text: t('guide.progression.text2') },
        { subtitle: t('guide.progression.subtitle3'), text: t('guide.progression.text3') },
        { subtitle: t('guide.progression.subtitle4'), text: t('guide.progression.text4') },
        { subtitle: t('guide.progression.subtitle5'), text: t('guide.progression.text5') }
      ]
    },
    advanced: {
      title: '🔮 ' + t('guide.menuAdvanced'),
      icon: '💎',
      content: [
        { subtitle: t('guide.advanced.subtitle1'), text: t('guide.advanced.text1') },
        { subtitle: t('guide.advanced.subtitle2'), text: t('guide.advanced.text2') },
        { subtitle: t('guide.advanced.subtitle3'), text: t('guide.advanced.text3') },
        { subtitle: t('guide.advanced.subtitle4'), text: t('guide.advanced.text4') },
        { subtitle: t('guide.advanced.subtitle5'), text: t('guide.advanced.text5') }
      ]
    },
    faq: {
      title: '❓ ' + t('guide.menuFaq'),
      icon: '💬',
      content: [
        { subtitle: t('guide.faq.q1.title'), text: t('guide.faq.q1.body') },
        { subtitle: t('guide.faq.q2.title'), text: t('guide.faq.q2.body') },
        { subtitle: t('guide.faq.q3.title'), text: t('guide.faq.q3.body') },
        { subtitle: t('guide.faq.q4.title'), text: t('guide.faq.q4.body') },
        { subtitle: t('guide.faq.q5.title'), text: t('guide.faq.q5.body') }
      ]
    }
  }

  const menuItems = [
    { id: 'intro', labelKey: 'guide.menuIntro', icon: '🌟' },
    { id: 'rules', labelKey: 'guide.menuRules', icon: '⚔️' },
    { id: 'tactics', labelKey: 'guide.menuTactics', icon: '🧠' },
    { id: 'modes', labelKey: 'guide.menuModes', icon: '🏆' },
    { id: 'progression', labelKey: 'guide.menuProgression', icon: '✨' },
    { id: 'advanced', labelKey: 'guide.menuAdvanced', icon: '🔮' },
    { id: 'faq', labelKey: 'guide.menuFaq', icon: '❓' }
  ]

  const currentGuide = guideData[selectedSection as keyof typeof guideData]

  const itemsToShow = (compact && !isMobile) ? Math.min((currentGuide?.content?.length || 0), 3) : (currentGuide?.content?.length || 0)

  // Mobile: navigate sections
  const currentIndex = menuItems.findIndex(m => m.id === selectedSection)
  const goToPrev = () => {
    if (currentIndex > 0) setSelectedSection(menuItems[currentIndex - 1].id)
  }
  const goToNext = () => {
    if (currentIndex < menuItems.length - 1) setSelectedSection(menuItems[currentIndex + 1].id)
  }

  return (
    <div className="guide-container" style={{
      maxWidth: 1120,
      margin: '0 auto',
      padding: isMobile ? '12px' : (compact ? '8px 12px' : undefined)
    }}>
      {/* Breadcrumb Navigation */}
      <nav style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        fontSize: compact ? '12px' : '13px', 
        color: 'rgba(255,255,255,0.5)',
        marginBottom: compact ? '8px' : '16px',
        padding: compact ? '8px 12px 0' : '20px 24px 0'
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
        <span style={{ color: '#fff' }}>{t('guide.breadcrumbGuide')}</span>
      </nav>
      
      {/* Decorative Background Elements */}
      {!compact && (
        <div className="guide-bg-decoration">
          <div className="floating-orb orb-1"></div>
          <div className="floating-orb orb-2"></div>
          <div className="floating-orb orb-3"></div>
        </div>
      )}

      {/* Header (centered, no expand button) */}
      <div className="guide-header">
        <div className="guide-title-wrapper">
          <div className="guide-title-icon">📚</div>
          <div>
            <h1 className="guide-main-title">{t('guide.mainTitle')}</h1>
            <p className="guide-subtitle">{t('guide.mainSubtitle')}</p>
          </div>
        </div>
      </div>

      {/* Mobile Section Tabs - Horizontal scroll */}
      {isMobile && (
        <div className="guide-mobile-tabs" style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '12px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedSection(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 14px',
                borderRadius: '20px',
                border: selectedSection === item.id 
                  ? '1px solid rgba(34, 211, 238, 0.5)' 
                  : '1px solid rgba(148, 163, 184, 0.25)',
                background: selectedSection === item.id 
                  ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.15), rgba(99, 102, 241, 0.1))' 
                  : 'rgba(15, 23, 42, 0.6)',
                color: selectedSection === item.id ? '#22D3EE' : '#e2e8f0',
                fontSize: '13px',
                fontWeight: selectedSection === item.id ? 600 : 400,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '16px' }}>{item.icon}</span>
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="guide-content-grid" style={{
        display: isMobile ? 'block' : 'grid',
        gridTemplateColumns: isMobile ? undefined : 'minmax(200px, 240px) 1fr',
        gap: compact ? 10 : 20,
        alignItems: 'start'
      }}>
        {/* Left Sidebar - Navigation (hidden on mobile) */}
        {!isMobile && (
          <div className="guide-sidebar" style={{ position: 'sticky', top: compact ? 8 : 16, alignSelf: 'start' }}>
            <div className="guide-menu-title" style={{ marginBottom: compact ? 8 : undefined, fontSize: compact ? 14 : undefined }}>📖 {t('guide.tableOfContents')}</div>
            <div className="guide-menu" style={{
              display: compact ? 'grid' : undefined,
              gridTemplateColumns: compact ? '1fr 1fr' : undefined,
              gap: compact ? 8 : undefined
            }}>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  className={`guide-menu-item ${selectedSection === item.id ? 'active' : ''}`}
                  onClick={() => setSelectedSection(item.id)}
                  style={{
                    display: 'flex',
                    flexDirection: compact ? 'column' as const : undefined,
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: compact ? '8px 6px' : undefined,
                    minHeight: compact ? 64 : undefined
                  }}
                >
                  <span className="menu-icon" style={{ fontSize: compact ? 18 : undefined, lineHeight: 1 }}>{item.icon}</span>
                  <span className="menu-label" style={{
                    fontSize: compact ? 12 : undefined,
                    marginTop: compact ? 2 : undefined,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    width: '100%'
                  }}>{t(item.labelKey)}</span>
                  {!compact && selectedSection === item.id && (
                    <div className="menu-active-indicator"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Right Content Panel */}
        <div className="guide-main-panel" style={{ 
          padding: isMobile ? 0 : (compact ? 12 : 20),
          paddingBottom: isMobile ? '100px' : undefined
        }}>
          {/* Section Header */}
          <div className="section-header" style={{ 
            marginBottom: isMobile ? 12 : (compact ? 8 : 16),
            padding: isMobile ? '16px' : undefined,
            background: isMobile ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.9))' : undefined,
            borderRadius: isMobile ? '12px' : undefined,
            border: isMobile ? '1px solid rgba(71, 85, 105, 0.3)' : undefined
          }}>
            <div className="section-icon-large" style={{ fontSize: isMobile ? 28 : (compact ? 20 : undefined) }}>{currentGuide.icon}</div>
            <h2 className="section-title" style={{ fontSize: isMobile ? 18 : (compact ? 18 : undefined), margin: compact || isMobile ? 0 : undefined }}>{currentGuide.title}</h2>
          </div>

          {/* Content Cards */}
          <div className="guide-content-list" style={{
            display: isMobile ? 'flex' : 'grid',
            flexDirection: isMobile ? 'column' : undefined,
            gridTemplateColumns: (!isMobile && compact) ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
            gap: isMobile ? 8 : (compact ? 10 : 16)
          }}>
            {currentGuide.content.slice(0, itemsToShow).map((item, index) => (
              <div key={index} className="guide-content-card" style={{ 
                padding: isMobile ? 14 : (compact ? 8 : 14), 
                gap: compact ? 6 : undefined,
                background: isMobile ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.85))' : undefined,
                border: isMobile ? '1px solid rgba(71, 85, 105, 0.25)' : undefined,
                borderRadius: isMobile ? '10px' : undefined
              }}>
                <div className="card-number" style={{ 
                  fontSize: isMobile ? 11 : (compact ? 12 : undefined), 
                  minWidth: isMobile ? 22 : (compact ? 22 : undefined), 
                  height: isMobile ? 22 : (compact ? 22 : undefined),
                  background: isMobile ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : undefined,
                  borderRadius: isMobile ? '6px' : undefined,
                  flexShrink: 0
                }}>{index + 1}</div>
                <div className="card-body" style={{ flex: 1, minWidth: 0 }}>
                  <h3 className="card-subtitle" style={{ 
                    fontSize: isMobile ? 14 : (compact ? 13 : undefined), 
                    margin: isMobile ? '0 0 6px 0' : (compact ? '0 0 2px 0' : undefined),
                    fontWeight: isMobile ? 600 : undefined,
                    color: isMobile ? '#f3f4f6' : undefined,
                    lineHeight: isMobile ? 1.3 : undefined
                  }}>{item.subtitle}</h3>
                  <p className="card-text" style={{ 
                    fontSize: isMobile ? 13 : (compact ? 12 : undefined), 
                    lineHeight: isMobile ? 1.5 : (compact ? 1.25 : undefined),
                    color: isMobile ? 'rgba(255, 255, 255, 0.7)' : undefined,
                    margin: isMobile ? 0 : undefined
                  }}>{item.text}</p>
                </div>
                {!compact && !isMobile && <div className="card-glow-effect"></div>}
              </div>
            ))}
          </div>

          {compact && !isMobile && currentGuide.content.length > itemsToShow && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
              <button
                onClick={() => setCompact(false)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(148,163,184,0.35)',
                  background: 'rgba(15,23,42,0.6)',
                  color: '#E2E8F0',
                  cursor: 'pointer'
                }}
              >
                {t('guide.viewMore')}
              </button>
            </div>
          )}

          {/* Navigation Footer - Fixed on mobile */}
          <div className="guide-nav-footer" style={{ 
            marginTop: isMobile ? 0 : (compact ? 8 : 16), 
            gap: compact ? 8 : undefined,
            position: isMobile ? 'fixed' : undefined,
            bottom: isMobile ? 0 : undefined,
            left: isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            background: isMobile ? 'linear-gradient(180deg, rgba(15, 23, 42, 0.95), rgba(8, 14, 29, 0.98))' : undefined,
            padding: isMobile ? '12px 16px' : undefined,
            borderTop: isMobile ? '1px solid rgba(71, 85, 105, 0.3)' : undefined,
            zIndex: isMobile ? 100 : undefined,
            backdropFilter: isMobile ? 'blur(12px)' : undefined
          }}>
            <button 
              className="guide-nav-btn prev"
              onClick={goToPrev}
              disabled={currentIndex === 0}
              style={{ 
                padding: isMobile ? '12px 16px' : (compact ? '6px 8px' : undefined), 
                fontSize: isMobile ? 13 : (compact ? 12 : undefined),
                flex: isMobile ? 1 : undefined,
                background: isMobile ? 'rgba(255, 255, 255, 0.05)' : undefined,
                border: isMobile ? '1px solid rgba(255, 255, 255, 0.1)' : undefined,
                borderRadius: isMobile ? '10px' : undefined,
                color: isMobile ? '#e2e8f0' : undefined,
                fontWeight: isMobile ? 600 : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span className="nav-arrow" style={{ fontSize: isMobile ? 14 : (compact ? 12 : undefined) }}>←</span>
              <span>{t('guide.prevSection')}</span>
            </button>
            <div className="guide-progress-indicator" style={{ 
              fontSize: isMobile ? 11 : (compact ? 12 : undefined),
              position: isMobile ? 'absolute' : undefined,
              top: isMobile ? '-28px' : undefined,
              left: isMobile ? '50%' : undefined,
              transform: isMobile ? 'translateX(-50%)' : undefined,
              background: isMobile ? 'rgba(15, 23, 42, 0.9)' : undefined,
              padding: isMobile ? '4px 12px' : undefined,
              borderRadius: isMobile ? '12px' : undefined,
              color: isMobile ? 'rgba(255, 255, 255, 0.6)' : undefined,
              border: isMobile ? '1px solid rgba(71, 85, 105, 0.3)' : undefined
            }}>
              {currentIndex + 1} / {menuItems.length}
            </div>
            <button 
              className="guide-nav-btn next"
              onClick={goToNext}
              disabled={currentIndex === menuItems.length - 1}
              style={{ 
                padding: isMobile ? '12px 16px' : (compact ? '6px 8px' : undefined), 
                fontSize: isMobile ? 13 : (compact ? 12 : undefined),
                flex: isMobile ? 1 : undefined,
                background: isMobile ? 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2))' : undefined,
                border: isMobile ? '1px solid rgba(34, 211, 238, 0.3)' : undefined,
                borderRadius: isMobile ? '10px' : undefined,
                color: isMobile ? '#22D3EE' : undefined,
                fontWeight: isMobile ? 600 : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer'
              }}
            >
              <span>{t('guide.nextSection')}</span>
              <span className="nav-arrow" style={{ fontSize: isMobile ? 14 : (compact ? 12 : undefined) }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
