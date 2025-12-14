import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { Title, TITLE_RARITIES } from '../../lib/titleApi'

interface TitleCardProps {
  title: Title
  unlocked?: boolean
  equipped?: boolean
  unlockedAt?: string
  onEquip?: () => void
  onUnequip?: () => void
  compact?: boolean
}

export function TitleCard({
  title,
  unlocked = false,
  equipped = false,
  unlockedAt,
  onEquip,
  onUnequip,
  compact = false
}: TitleCardProps) {
  const { language, t } = useLanguage()
  
  const name = language === 'vi' ? title.name_vi : title.name_en
  const description = language === 'vi' ? title.description_vi : title.description_en
  const rarityInfo = TITLE_RARITIES[title.rarity]
  const rarityName = language === 'vi' ? rarityInfo.name_vi : rarityInfo.name_en

  if (compact) {
    return (
      <div
        className={`title-card-compact ${unlocked ? 'unlocked' : 'locked'} ${equipped ? 'equipped' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 8,
          background: unlocked 
            ? `linear-gradient(135deg, ${title.color}15, ${title.color}05)` 
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${unlocked ? title.color + '40' : 'rgba(255,255,255,0.1)'}`,
          opacity: unlocked ? 1 : 0.5,
          cursor: unlocked && onEquip ? 'pointer' : 'default'
        }}
        onClick={() => {
          if (unlocked && !equipped && onEquip) onEquip()
          if (equipped && onUnequip) onUnequip()
        }}
      >
        <span style={{ fontSize: 18 }}>{title.icon}</span>
        <span style={{ 
          color: unlocked ? title.color : 'var(--color-muted)',
          fontWeight: 600,
          fontSize: 13
        }}>
          {name}
        </span>
        {equipped && (
          <span style={{ 
            marginLeft: 'auto',
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: title.color + '30',
            color: title.color
          }}>
            {t('title.equipped')}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className={`title-card ${unlocked ? 'unlocked' : 'locked'} ${equipped ? 'equipped' : ''} rarity-${title.rarity}`}
      style={{
        position: 'relative',
        padding: 16,
        borderRadius: 12,
        background: unlocked 
          ? `linear-gradient(135deg, ${title.color}20, ${title.color}08)` 
          : 'rgba(255,255,255,0.03)',
        border: `2px solid ${unlocked ? title.color + '60' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: unlocked && title.glow_color 
          ? `0 0 20px ${title.glow_color}` 
          : 'none',
        opacity: unlocked ? 1 : 0.6,
        transition: 'all 0.3s ease'
      }}
    >
      {/* Rarity badge */}
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        fontSize: 10,
        padding: '2px 8px',
        borderRadius: 4,
        background: rarityInfo.color + '30',
        color: rarityInfo.color,
        fontWeight: 600
      }}>
        {rarityName}
      </div>

      {/* Icon & Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ 
          fontSize: 32,
          filter: unlocked ? 'none' : 'grayscale(1)'
        }}>
          {title.icon}
        </span>
        <div>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 700,
            color: unlocked ? title.color : 'var(--color-muted)'
          }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>
            +{title.points} {t('title.points')}
          </div>
        </div>
      </div>

      {/* Description */}
      {description && (
        <div style={{ 
          fontSize: 12, 
          color: 'var(--color-muted)',
          marginBottom: 12,
          lineHeight: 1.4
        }}>
          {description}
        </div>
      )}

      {/* Unlocked date */}
      {unlocked && unlockedAt && (
        <div style={{ 
          fontSize: 10, 
          color: 'var(--color-muted)',
          marginBottom: 8
        }}>
          {t('title.unlockedAt')}: {new Date(unlockedAt).toLocaleDateString()}
        </div>
      )}

      {/* Actions */}
      {unlocked && (
        <div style={{ display: 'flex', gap: 8 }}>
          {equipped ? (
            <button
              onClick={onUnequip}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: 'var(--color-muted)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              {t('title.unequip')}
            </button>
          ) : (
            <button
              onClick={onEquip}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                background: title.color,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {t('title.equip')}
            </button>
          )}
        </div>
      )}

      {/* Locked overlay */}
      {!unlocked && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 12px',
          borderRadius: 6,
          background: 'rgba(0,0,0,0.3)',
          color: 'var(--color-muted)',
          fontSize: 11
        }}>
          🔒 {t('title.locked')}
        </div>
      )}
    </div>
  )
}

/**
 * Component hiển thị danh hiệu đang trang bị (nhỏ gọn, dùng trong profile/header)
 */
export function EquippedTitleBadge({ 
  title, 
  size = 'normal' 
}: { 
  title: Title
  size?: 'small' | 'normal' | 'large'
}) {
  const { language } = useLanguage()
  const name = language === 'vi' ? title.name_vi : title.name_en

  const sizes = {
    small: { fontSize: 10, padding: '2px 6px', iconSize: 12 },
    normal: { fontSize: 12, padding: '4px 10px', iconSize: 14 },
    large: { fontSize: 14, padding: '6px 14px', iconSize: 18 }
  }

  const s = sizes[size]

  return (
    <div
      className="equipped-title-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: s.padding,
        borderRadius: 6,
        background: `linear-gradient(135deg, ${title.color}30, ${title.color}15)`,
        border: `1px solid ${title.color}50`,
        boxShadow: title.glow_color ? `0 0 10px ${title.glow_color}` : 'none'
      }}
    >
      <span style={{ fontSize: s.iconSize }}>{title.icon}</span>
      <span style={{ 
        fontSize: s.fontSize, 
        fontWeight: 600,
        color: title.color
      }}>
        {name}
      </span>
    </div>
  )
}
