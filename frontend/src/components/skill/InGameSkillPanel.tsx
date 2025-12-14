import { useState, useEffect } from 'react'
import { Skill, SKILL_ICONS, RARITY_COLORS } from '../../lib/skillApi'
import { useLanguage } from '../../contexts/LanguageContext'
import SkillTargetSelector from './SkillTargetSelector'

interface InGameSkillPanelProps {
  skills: Skill[]
  cooldowns: Record<string, number>
  timeLimit?: number
  disabled?: boolean
  mana?: number
  disabledMap?: Record<string, string>
  board?: (string | null)[][] // Board state for target selection
  playerSide?: string
  enemySide?: string
  onUseSkill: (skill: Skill, context?: Record<string, any>) => void
  onSkip: () => void
}

// Skills that require target selection
const SKILLS_REQUIRING_TARGET = [
  'destroy_piece', 'temp_remove', 'convert_piece', 'immobilize', 'protect_piece',
  'permanent_protect', 'destroy_immunity', 'teleport_piece', 'burn_area', 'chaos_move',
  'immunity_area', 'shield_area', 'reset_area', 'block_cell', 'push_chain', 'push_enemy',
  'swap_pieces', 'reflect_trap', 'dual_protect', 'break_chain', 'anchor_piece'
]

export default function InGameSkillPanel({
  skills,
  cooldowns,
  timeLimit = 10,
  disabled = false,
  mana = 0,
  disabledMap = {},
  board,
  playerSide = 'black',
  enemySide = 'white',
  onUseSkill,
  onSkip
}: InGameSkillPanelProps) {
  const { language } = useLanguage()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(timeLimit)
  const [showTargetSelector, setShowTargetSelector] = useState(false)
  const [pendingSkill, setPendingSkill] = useState<Skill | null>(null)

  // Timer
  useEffect(() => {
    if (disabled) return
    setTimeRemaining(timeLimit)
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onSkip()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [skills, disabled, timeLimit, onSkip])

  const handleSelect = (index: number) => {
    if (disabled) return
    const skill = skills[index]
    if (disabledMap[skill.id]) return
    if (cooldowns[skill.id] && cooldowns[skill.id] > 0) return
    setSelectedIndex(index)
  }

  const handleConfirm = () => {
    if (selectedIndex === null || disabled) return
    const skill = skills[selectedIndex]
    
    // Check if skill requires target selection
    if (SKILLS_REQUIRING_TARGET.includes(skill.effect_type) && board) {
      setPendingSkill(skill)
      setShowTargetSelector(true)
      return
    }
    
    // No target needed, use directly
    onUseSkill(skill)
    setSelectedIndex(null)
  }
  
  const handleTargetConfirm = (context: Record<string, any>) => {
    if (!pendingSkill) return
    onUseSkill(pendingSkill, context)
    setShowTargetSelector(false)
    setPendingSkill(null)
    setSelectedIndex(null)
  }
  
  const handleTargetCancel = () => {
    setShowTargetSelector(false)
    setPendingSkill(null)
  }

  return (
    <div style={{
      background: 'rgba(15,23,42,0.95)',
      borderRadius: 16,
      padding: 16,
      border: '1px solid rgba(148,163,184,0.2)',
      minWidth: 320
    }}>
      {/* Header with timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#E2E8F0' }}>Chon Skill</span>
          <span style={{ fontSize: 12, color: '#94A3B8' }}>Mana: {mana}</span>
        </div>
        <div style={{
          padding: '4px 12px',
          borderRadius: 20,
          background: timeRemaining <= 3 ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
          color: timeRemaining <= 3 ? '#F87171' : '#60A5FA',
          fontWeight: 700,
          fontSize: 14
        }}>
          Time {timeRemaining}s
        </div>
      </div>

      {/* Skill Cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {skills.map((skill, index) => {
          const isOnCooldown = cooldowns[skill.id] && cooldowns[skill.id] > 0
          const lockedReason = disabledMap[skill.id]
          const isDisabled = !!lockedReason || isOnCooldown
          const isSelected = selectedIndex === index
          const name = language === 'vi' ? skill.name_vi : (skill.name_en || skill.name_vi)
          const icon = skill.icon_url || SKILL_ICONS[skill.skill_code] || '❓'

          return (
            <div
              key={skill.id}
              onClick={() => handleSelect(index)}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 12,
                border: `2px solid ${isSelected ? '#60A5FA' : isDisabled ? '#475569' : RARITY_COLORS[skill.rarity]}`,
                background: isSelected 
                  ? 'rgba(59,130,246,0.2)' 
                  : isDisabled 
                    ? 'rgba(30,41,59,0.5)' 
                    : 'rgba(30,41,59,0.8)',
                cursor: isDisabled || disabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                textAlign: 'center',
                position: 'relative',
                transition: 'all 0.2s'
              }}
            >
              {/* Cooldown / lock overlay */}
              {isDisabled && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: '#94A3B8'
                }}>
                  {lockedReason ? lockedReason : cooldowns[skill.id]}
                </div>
              )}

              <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#E2E8F0', marginBottom: 4 }}>{name}</div>
              <div style={{ 
                fontSize: 9, 
                color: RARITY_COLORS[skill.rarity],
                textTransform: 'uppercase',
                fontWeight: 600
              }}>
                {skill.rarity}
              </div>
              {/* Mana cost */}
              <div style={{
                position: 'absolute',
                top: 4,
                right: 4,
                background: (skill.mana_cost ?? 0) > mana ? 'rgba(239,68,68,0.8)' : 'rgba(59,130,246,0.8)',
                borderRadius: 8,
                padding: '2px 6px',
                fontSize: 10,
                fontWeight: 700,
                color: '#fff'
              }}>
                {skill.mana_cost ?? 0}💧
              </div>
            </div>
          )
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSkip}
          disabled={disabled}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.3)',
            background: 'transparent',
            color: '#94A3B8',
            fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer'
          }}
        >
          Bo qua
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedIndex === null || disabled}
          style={{
            flex: 2,
            padding: '10px',
            borderRadius: 8,
            border: 'none',
            background: selectedIndex !== null 
              ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' 
              : '#475569',
            color: '#fff',
            fontWeight: 700,
            cursor: selectedIndex === null || disabled ? 'not-allowed' : 'pointer'
          }}
        >
          Su dung
        </button>
      </div>
      
      {/* Target Selector Modal */}
      {showTargetSelector && pendingSkill && board && (
        <SkillTargetSelector
          skill={pendingSkill}
          board={board}
          playerSide={playerSide}
          enemySide={enemySide}
          onConfirm={handleTargetConfirm}
          onCancel={handleTargetCancel}
        />
      )}
    </div>
  )
}
