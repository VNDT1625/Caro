import React, { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'

export default function Guide() {
  const { t } = useLanguage()
  const [selectedSection, setSelectedSection] = useState<string>('intro')
  const [compact, setCompact] = useState<boolean>(true)

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

  const itemsToShow = compact ? Math.min((currentGuide?.content?.length || 0), 3) : (currentGuide?.content?.length || 0)

  return (
    <div className="guide-container" style={{
      maxWidth: 1120,
      margin: '0 auto',
      padding: compact ? '8px 12px' : undefined
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

      {/* Main Content */}
      <div className="guide-content-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 240px) 1fr',
        gap: compact ? 10 : 20,
        alignItems: 'start'
      }}>
        {/* Left Sidebar - Navigation */}
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

        {/* Right Content Panel */}
        <div className="guide-main-panel" style={{ padding: compact ? 12 : 20 }}>
          {/* Section Header */}
          <div className="section-header" style={{ marginBottom: compact ? 8 : 16 }}>
            <div className="section-icon-large" style={{ fontSize: compact ? 20 : undefined }}>{currentGuide.icon}</div>
            <h2 className="section-title" style={{ fontSize: compact ? 18 : undefined, margin: compact ? 0 : undefined }}>{currentGuide.title}</h2>
          </div>

          {/* Content Cards */}
          <div className="guide-content-list" style={{
            display: 'grid',
            gridTemplateColumns: compact ? 'repeat(auto-fit, minmax(220px, 1fr))' : '1fr',
            gap: compact ? 10 : 16
          }}>
            {currentGuide.content.slice(0, itemsToShow).map((item, index) => (
              <div key={index} className="guide-content-card" style={{ padding: compact ? 8 : 14, gap: compact ? 6 : undefined }}>
                <div className="card-number" style={{ fontSize: compact ? 12 : undefined, minWidth: compact ? 22 : undefined, height: compact ? 22 : undefined }}>{index + 1}</div>
                <div className="card-body">
                  <h3 className="card-subtitle" style={{ fontSize: compact ? 13 : undefined, margin: compact ? '0 0 2px 0' : undefined }}>{item.subtitle}</h3>
                  <p className="card-text" style={{ fontSize: compact ? 12 : undefined, lineHeight: compact ? 1.25 : undefined }}>{item.text}</p>
                </div>
                {!compact && <div className="card-glow-effect"></div>}
              </div>
            ))}
          </div>

          {compact && currentGuide.content.length > itemsToShow && (
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

          {/* Navigation Footer */}
          <div className="guide-nav-footer" style={{ marginTop: compact ? 8 : 16, gap: compact ? 8 : undefined }}>
            <button 
              className="guide-nav-btn prev"
              onClick={() => {
                const currentIndex = menuItems.findIndex(m => m.id === selectedSection)
                if (currentIndex > 0) {
                  setSelectedSection(menuItems[currentIndex - 1].id)
                }
              }}
              disabled={menuItems.findIndex(m => m.id === selectedSection) === 0}
            style={{ padding: compact ? '6px 8px' : undefined, fontSize: compact ? 12 : undefined }}
            >
              <span className="nav-arrow" style={{ fontSize: compact ? 12 : undefined }}>←</span>
              <span>{t('guide.prevSection')}</span>
            </button>
            <div className="guide-progress-indicator" style={{ fontSize: compact ? 12 : undefined }}>
              {menuItems.findIndex(m => m.id === selectedSection) + 1} / {menuItems.length}
            </div>
            <button 
              className="guide-nav-btn next"
              onClick={() => {
                const currentIndex = menuItems.findIndex(m => m.id === selectedSection)
                if (currentIndex < menuItems.length - 1) {
                  setSelectedSection(menuItems[currentIndex + 1].id)
                }
              }}
              disabled={menuItems.findIndex(m => m.id === selectedSection) === menuItems.length - 1}
            style={{ padding: compact ? '6px 8px' : undefined, fontSize: compact ? 12 : undefined }}
            >
              <span>{t('guide.nextSection')}</span>
              <span className="nav-arrow" style={{ fontSize: compact ? 12 : undefined }}>→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
