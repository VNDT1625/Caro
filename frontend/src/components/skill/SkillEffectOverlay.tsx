import React, { useEffect, useState } from 'react'

interface SkillEffect {
  type: string
  x?: number
  y?: number
  duration?: number
  side?: string
  status?: string
  positions?: { x: number; y: number }[]
  center?: { x: number; y: number }
  radius?: number
  element?: string
}

interface SkillEffectOverlayProps {
  effects: SkillEffect[]
  cellSize: number
  boardOffset: { x: number; y: number }
}

// Effect colors by type
const EFFECT_COLORS: Record<string, string> = {
  fire: '#EF4444',
  ice: '#60A5FA',
  root: '#22C55E',
  stone: '#78716C',
  rust: '#F59E0B',
  protect: '#3B82F6',
  shield: '#8B5CF6',
  burn: '#F97316',
  freeze: '#06B6D4',
  immobilize: '#A855F7',
  seal: '#EC4899',
}

// Effect icons
const EFFECT_ICONS: Record<string, string> = {
  fire_spread: '🔥',
  ice_spread: '❄️',
  root_spread: '🌿',
  stone_spread: '🪨',
  rust_spread: '⚙️',
  protect_piece: '🛡️',
  protect_all: '✨',
  shield_area: '🔮',
  burn_area: '🔥',
  silence_all: '🤫',
  immobilize: '📌',
  seal_buff: '🔒',
  destroy_immunity: '💎',
  fake_piece: '👻',
  trap_reflect: '🪞',
  deck_lock: '🔐',
  luck_buff: '🍀',
}

export default function SkillEffectOverlay({
  effects,
  cellSize,
  boardOffset
}: SkillEffectOverlayProps) {
  const [animatingEffects, setAnimatingEffects] = useState<SkillEffect[]>([])
  
  useEffect(() => {
    setAnimatingEffects(effects)
  }, [effects])
  
  const renderEffect = (effect: SkillEffect, index: number) => {
    const { type, x, y, duration, positions, center, radius } = effect
    
    // Single cell effect
    if (x !== undefined && y !== undefined) {
      const color = EFFECT_COLORS[effect.status || type] || '#3B82F6'
      const icon = EFFECT_ICONS[type] || '✦'
      
      return (
        <div
          key={`${type}-${x}-${y}-${index}`}
          style={{
            position: 'absolute',
            left: boardOffset.x + x * cellSize,
            top: boardOffset.y + y * cellSize,
            width: cellSize,
            height: cellSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            animation: 'pulse 1s infinite'
          }}
        >
          <div style={{
            width: cellSize - 4,
            height: cellSize - 4,
            borderRadius: 4,
            background: `${color}33`,
            border: `2px solid ${color}`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ fontSize: cellSize * 0.4 }}>{icon}</span>
            {duration && (
              <span style={{ 
                fontSize: 10, 
                color: '#fff',
                fontWeight: 700,
                textShadow: '0 1px 2px rgba(0,0,0,0.5)'
              }}>
                {duration}
              </span>
            )}
          </div>
        </div>
      )
    }
    
    // Area effect (center + radius)
    if (center && radius !== undefined) {
      const color = EFFECT_COLORS[effect.status || type] || '#3B82F6'
      const size = (radius * 2 + 1) * cellSize
      
      return (
        <div
          key={`${type}-area-${index}`}
          style={{
            position: 'absolute',
            left: boardOffset.x + (center.x - radius) * cellSize,
            top: boardOffset.y + (center.y - radius) * cellSize,
            width: size,
            height: size,
            borderRadius: 8,
            background: `${color}22`,
            border: `2px dashed ${color}`,
            pointerEvents: 'none',
            animation: 'pulse 2s infinite'
          }}
        />
      )
    }
    
    // Multi-position effect
    if (positions && positions.length > 0) {
      const color = EFFECT_COLORS[effect.status || type] || '#3B82F6'
      const icon = EFFECT_ICONS[type] || '✦'
      
      return (
        <React.Fragment key={`${type}-multi-${index}`}>
          {positions.map((pos, i) => (
            <div
              key={`${type}-${pos.x}-${pos.y}-${i}`}
              style={{
                position: 'absolute',
                left: boardOffset.x + pos.x * cellSize,
                top: boardOffset.y + pos.y * cellSize,
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <div style={{
                width: cellSize - 4,
                height: cellSize - 4,
                borderRadius: 4,
                background: `${color}33`,
                border: `2px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: cellSize * 0.4
              }}>
                {icon}
              </div>
            </div>
          ))}
        </React.Fragment>
      )
    }
    
    return null
  }
  
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.6; }
          }
        `}
      </style>
      {animatingEffects.map((effect, index) => renderEffect(effect, index))}
    </div>
  )
}
