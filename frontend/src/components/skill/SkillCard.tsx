import React from 'react'
import { Skill, SKILL_ICONS, RARITY_COLORS, CATEGORY_COLORS } from '../../lib/skillApi'
import { useLanguage } from '../../contexts/LanguageContext'

interface SkillCardProps {
  skill: Skill
  selected?: boolean
  disabled?: boolean
  showDetails?: boolean
  size?: 'small' | 'medium' | 'large'
  onClick?: () => void
}

export default function SkillCard({ 
  skill, 
  selected = false, 
  disabled = false,
  showDetails = true,
  size = 'medium',
  onClick 
}: SkillCardProps) {
  const { language } = useLanguage()
  
  const name = language === 'vi' ? skill.name_vi : (skill.name_en || skill.name_vi)
  const desc = language === 'vi' ? skill.description_vi : (skill.description_en || skill.description_vi)
  const icon = skill.icon_url || SKILL_ICONS[skill.skill_code] || '❓'
  
  const sizeStyles = {
    small: { width: 60, height: 60, iconSize: 24, fontSize: 10 },
    medium: { width: 80, height: 100, iconSize: 32, fontSize: 11 },
    large: { width: 120, height: 140, iconSize: 40, fontSize: 12 }
  }
  
  const s = sizeStyles[size]
  
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: s.width,
        minHeight: s.height,
        padding: 8,
        borderRadius: 10,
        border: `2px solid ${selected ? '#60A5FA' : RARITY_COLORS[skill.rarity]}`,
        background: selected 
          ? 'rgba(59,130,246,0.2)' 
          : disabled 
            ? 'rgba(30,41,59,0.5)' 
            : 'rgba(30,41,59,0.8)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        position: 'relative'
      }}
    >
      {/* Rarity indicator */}
      <div style={{
        position: 'absolute',
        top: 4,
        right: 4,
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: RARITY_COLORS[skill.rarity]
      }} />
      
      {/* Category badge */}
      <div style={{
        position: 'absolute',
        top: 4,
        left: 4,
        fontSize: 8,
        padding: '1px 4px',
        borderRadius: 4,
        background: CATEGORY_COLORS[skill.category],
        color: '#fff',
        fontWeight: 600,
        textTransform: 'uppercase'
      }}>
        {skill.category.charAt(0)}
      </div>
      
      {/* Icon */}
      <div style={{ fontSize: s.iconSize, marginTop: 8 }}>{icon}</div>
      
      {/* Name */}
      <div style={{ 
        fontSize: s.fontSize, 
        fontWeight: 600, 
        textAlign: 'center',
        color: '#E2E8F0',
        lineHeight: 1.2
      }}>
        {name}
      </div>
      
      {/* Cooldown */}
      {showDetails && (
        <div style={{ 
          fontSize: 9, 
          color: '#94A3B8',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          ⏱️ {skill.cooldown}
        </div>
      )}
    </div>
  )
}
