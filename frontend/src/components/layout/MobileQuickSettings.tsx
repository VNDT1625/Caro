import React, { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { AudioManager } from '../../lib/AudioManager'

interface MobileQuickSettingsProps {
  onOpenFullSettings?: () => void
}

export default function MobileQuickSettings({ onOpenFullSettings }: MobileQuickSettingsProps) {
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  
  // Load settings from localStorage
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('gameSettings')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    return {
      bgMusic: true,
      bgMusicVolume: 70,
      sfxEnabled: true,
      sfxVolume: 80,
      vibrationEnabled: true
    }
  }
  
  const [settings, setSettings] = useState(loadSettings())
  
  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    
    try {
      const fullSettings = JSON.parse(localStorage.getItem('gameSettings') || '{}')
      localStorage.setItem('gameSettings', JSON.stringify({ ...fullSettings, [key]: value }))
      
      // Update AudioManager
      AudioManager.updateSettings({
        bgMusic: newSettings.bgMusic,
        bgMusicVolume: newSettings.bgMusicVolume,
        sfxEnabled: newSettings.sfxEnabled,
        sfxVolume: newSettings.sfxVolume
      })
    } catch (e) {
      console.error('Failed to save setting:', e)
    }
  }
  
  if (!isOpen) {
    return (
      <button 
        className="mobile-quick-settings-btn"
        onClick={() => setIsOpen(true)}
        aria-label={t('settings.quickSettings')}
      >
        ⚙️
      </button>
    )
  }
  
  return (
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9998
        }}
        onClick={() => setIsOpen(false)}
      />
      
      {/* Modal */}
      <div className="quick-settings-modal" style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        borderRadius: 20,
        padding: 20,
        zIndex: 9999,
        width: 'calc(100vw - 40px)',
        maxWidth: 320,
        maxHeight: '70vh',
        overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)'
      }}>
        {/* Header */}
        <div className="quick-settings-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 12,
          marginBottom: 16,
          borderBottom: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <h3 className="quick-settings-title" style={{ margin: 0, fontSize: 16, color: '#fff' }}>
            ⚙️ {t('settings.quickSettings')}
          </h3>
          <button 
            onClick={() => setIsOpen(false)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: 20,
              cursor: 'pointer',
              padding: 4
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Sound Section */}
        <div className="quick-settings-section" style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, color: '#22D3EE', margin: '0 0 12px 0' }}>
            🔊 {t('settings.sound')}
          </h4>
          
          {/* Background Music Toggle */}
          <div className="quick-settings-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0'
          }}>
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>{t('settings.bgMusic')}</span>
            <button
              onClick={() => updateSetting('bgMusic', !settings.bgMusic)}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                border: 'none',
                background: settings.bgMusic 
                  ? 'linear-gradient(90deg, #22D3EE, #06B6D4)' 
                  : 'rgba(148, 163, 184, 0.3)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: settings.bgMusic ? 25 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
          
          {/* Music Volume */}
          {settings.bgMusic && (
            <div style={{ padding: '8px 0' }}>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.bgMusicVolume}
                onChange={(e) => updateSetting('bgMusicVolume', parseInt(e.target.value))}
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  appearance: 'none',
                  background: `linear-gradient(to right, #22D3EE ${settings.bgMusicVolume}%, rgba(148,163,184,0.3) ${settings.bgMusicVolume}%)`
                }}
              />
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 }}>
                {settings.bgMusicVolume}%
              </div>
            </div>
          )}
          
          {/* SFX Toggle */}
          <div className="quick-settings-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0'
          }}>
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>{t('settings.sfx')}</span>
            <button
              onClick={() => updateSetting('sfxEnabled', !settings.sfxEnabled)}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                border: 'none',
                background: settings.sfxEnabled 
                  ? 'linear-gradient(90deg, #22D3EE, #06B6D4)' 
                  : 'rgba(148, 163, 184, 0.3)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: settings.sfxEnabled ? 25 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        </div>
        
        {/* Vibration Section */}
        <div className="quick-settings-section" style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, color: '#FBBF24', margin: '0 0 12px 0' }}>
            📳 {t('settings.vibration')}
          </h4>
          
          <div className="quick-settings-row" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 0'
          }}>
            <span style={{ fontSize: 13, color: '#e2e8f0' }}>{t('settings.vibrationEnabled')}</span>
            <button
              onClick={() => updateSetting('vibrationEnabled', !settings.vibrationEnabled)}
              style={{
                width: 48,
                height: 26,
                borderRadius: 13,
                border: 'none',
                background: settings.vibrationEnabled 
                  ? 'linear-gradient(90deg, #FBBF24, #F59E0B)' 
                  : 'rgba(148, 163, 184, 0.3)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all 0.2s ease'
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: settings.vibrationEnabled ? 25 : 3,
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        </div>
        
        {/* Full Settings Link */}
        {onOpenFullSettings && (
          <button
            onClick={() => {
              setIsOpen(false)
              onOpenFullSettings()
            }}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid rgba(148, 163, 184, 0.3)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: '#e2e8f0',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            {t('settings.allSettings')} →
          </button>
        )}
      </div>
    </>
  )
}
