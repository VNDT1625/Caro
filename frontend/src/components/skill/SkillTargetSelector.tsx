import React, { useState, useCallback } from 'react'
import { Skill } from '../../lib/skillApi'

interface Position {
  x: number
  y: number
}

interface SkillTargetSelectorProps {
  skill: Skill
  board: (string | null)[][]
  playerSide: string
  enemySide: string
  onConfirm: (context: Record<string, any>) => void
  onCancel: () => void
}

// Skill types that need specific targeting
const SKILL_TARGET_TYPES: Record<string, string> = {
  // Single target skills
  destroy_piece: 'single_enemy',
  temp_remove: 'single_enemy',
  convert_piece: 'single_enemy',
  immobilize: 'single_any',
  protect_piece: 'single_own',
  permanent_protect: 'single_own',
  destroy_immunity: 'single_own',
  teleport_piece: 'two_positions', // from + to
  
  // Area skills
  burn_area: 'area_3x3',
  chaos_move: 'area_3x3',
  immunity_area: 'area_3x3',
  shield_area: 'area_3x3',
  reset_area: 'area_4x4',
  block_cell: 'single_empty',
  
  // Direction skills
  push_chain: 'target_direction',
  push_enemy: 'target_direction',
  
  // Multi-target skills
  swap_pieces: 'two_pieces',
  reflect_trap: 'three_own',
  dual_protect: 'two_own',
  break_chain: 'two_enemy',
}

export default function SkillTargetSelector({
  skill,
  board,
  playerSide,
  enemySide,
  onConfirm,
  onCancel
}: SkillTargetSelectorProps) {
  const [selectedPositions, setSelectedPositions] = useState<Position[]>([])
  const [direction, setDirection] = useState<string | null>(null)
  
  const targetType = SKILL_TARGET_TYPES[skill.effect_type] || 'none'
  
  const getRequiredCount = () => {
    if (targetType.startsWith('two')) return 2
    if (targetType === 'three_own') return 3
    return 1
  }
  
  const isValidTarget = useCallback((x: number, y: number) => {
    const cell = board[y]?.[x]
    
    switch (targetType) {
      case 'single_enemy':
        return cell === enemySide
      case 'single_own':
        return cell === playerSide
      case 'single_any':
        return cell === playerSide || cell === enemySide
      case 'single_empty':
        return cell === null
      case 'two_positions':
        if (selectedPositions.length === 0) return cell === playerSide
        return cell === null
      case 'two_pieces':
        return cell === playerSide || cell === enemySide
      case 'two_own':
      case 'three_own':
        return cell === playerSide
      case 'two_enemy':
        return cell === enemySide
      case 'area_3x3':
      case 'area_4x4':
        return true // Any position for area center
      case 'target_direction':
        if (selectedPositions.length === 0) return cell === enemySide
        return false
      default:
        return false
    }
  }, [targetType, board, playerSide, enemySide, selectedPositions])
  
  const handleCellClick = (x: number, y: number) => {
    if (!isValidTarget(x, y)) return
    
    const newPos = { x, y }
    const requiredCount = getRequiredCount()
    
    if (targetType === 'target_direction' && selectedPositions.length === 1) {
      // Already have target, now need direction
      return
    }
    
    if (selectedPositions.length < requiredCount) {
      setSelectedPositions([...selectedPositions, newPos])
    } else {
      // Replace last selection
      setSelectedPositions([...selectedPositions.slice(0, -1), newPos])
    }
  }
  
  const handleDirectionSelect = (dir: string) => {
    setDirection(dir)
  }
  
  const handleConfirm = () => {
    const context: Record<string, any> = {}
    
    if (selectedPositions.length === 1) {
      context.target_position = selectedPositions[0]
    } else if (selectedPositions.length > 1) {
      context.target_positions = selectedPositions
    }
    
    if (direction) {
      context.push_direction = direction
    }
    
    context.player_side = playerSide
    context.enemy_side = enemySide
    
    onConfirm(context)
  }
  
  const canConfirm = () => {
    const requiredCount = getRequiredCount()
    if (selectedPositions.length < requiredCount) return false
    if (targetType === 'target_direction' && !direction) return false
    return true
  }
  
  const getInstructions = () => {
    switch (targetType) {
      case 'single_enemy': return 'Chọn 1 quân địch'
      case 'single_own': return 'Chọn 1 quân của bạn'
      case 'single_any': return 'Chọn 1 quân bất kỳ'
      case 'single_empty': return 'Chọn 1 ô trống'
      case 'two_positions': return selectedPositions.length === 0 
        ? 'Chọn quân cần di chuyển' 
        : 'Chọn ô đích'
      case 'two_pieces': return `Chọn 2 quân (${selectedPositions.length}/2)`
      case 'two_own': return `Chọn 2 quân của bạn (${selectedPositions.length}/2)`
      case 'two_enemy': return `Chọn 2 quân địch (${selectedPositions.length}/2)`
      case 'three_own': return `Chọn 3 quân của bạn (${selectedPositions.length}/3)`
      case 'area_3x3': return 'Chọn tâm vùng 3x3'
      case 'area_4x4': return 'Chọn tâm vùng 4x4'
      case 'target_direction': 
        if (selectedPositions.length === 0) return 'Chọn quân địch cần đẩy'
        return 'Chọn hướng đẩy'
      default: return 'Chọn mục tiêu'
    }
  }
  
  const renderAreaPreview = () => {
    if (!selectedPositions[0]) return null
    const size = targetType === 'area_4x4' ? 4 : 3
    const offset = Math.floor(size / 2)
    const { x, y } = selectedPositions[0]
    
    const cells = []
    for (let dy = -offset; dy <= offset; dy++) {
      for (let dx = -offset; dx <= offset; dx++) {
        const px = x + dx
        const py = y + dy
        if (px >= 0 && px < 15 && py >= 0 && py < 15) {
          cells.push({ x: px, y: py })
        }
      }
    }
    return cells
  }
  
  const areaPreview = (targetType === 'area_3x3' || targetType === 'area_4x4') 
    ? renderAreaPreview() 
    : null

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      {/* Instructions */}
      <div style={{
        background: 'rgba(15,23,42,0.95)',
        padding: '12px 24px',
        borderRadius: 12,
        marginBottom: 16,
        color: '#E2E8F0',
        fontWeight: 600
      }}>
        {skill.name_vi}: {getInstructions()}
      </div>
      
      {/* Mini Board for selection */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(15, 24px)',
        gap: 1,
        background: '#1E293B',
        padding: 8,
        borderRadius: 8
      }}>
        {board.map((row, y) => 
          row.map((cell, x) => {
            const isSelected = selectedPositions.some(p => p.x === x && p.y === y)
            const isInArea = areaPreview?.some(p => p.x === x && p.y === y)
            const isValid = isValidTarget(x, y)
            
            return (
              <div
                key={`${x}-${y}`}
                onClick={() => handleCellClick(x, y)}
                style={{
                  width: 24,
                  height: 24,
                  background: isSelected 
                    ? '#3B82F6' 
                    : isInArea 
                      ? 'rgba(59,130,246,0.3)'
                      : cell === playerSide 
                        ? '#22C55E' 
                        : cell === enemySide 
                          ? '#EF4444'
                          : cell === 'BLOCKED'
                            ? '#475569'
                            : '#0F172A',
                  borderRadius: 4,
                  cursor: isValid ? 'pointer' : 'default',
                  opacity: isValid ? 1 : 0.5,
                  border: isSelected ? '2px solid #60A5FA' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12
                }}
              >
                {cell === playerSide && '●'}
                {cell === enemySide && '●'}
                {cell === 'BLOCKED' && '✕'}
              </div>
            )
          })
        )}
      </div>
      
      {/* Direction selector for push skills */}
      {targetType === 'target_direction' && selectedPositions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginTop: 16
        }}>
          {['up', 'down', 'left', 'right'].map(dir => (
            <button
              key={dir}
              onClick={() => handleDirectionSelect(dir)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: direction === dir ? '2px solid #3B82F6' : '1px solid #475569',
                background: direction === dir ? 'rgba(59,130,246,0.2)' : 'transparent',
                color: '#E2E8F0',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {dir === 'up' && '↑'}
              {dir === 'down' && '↓'}
              {dir === 'left' && '←'}
              {dir === 'right' && '→'}
            </button>
          ))}
        </div>
      )}
      
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: '1px solid #475569',
            background: 'transparent',
            color: '#94A3B8',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Hủy
        </button>
        <button
          onClick={handleConfirm}
          disabled={!canConfirm()}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: canConfirm() 
              ? 'linear-gradient(135deg, #3B82F6, #8B5CF6)' 
              : '#475569',
            color: '#fff',
            cursor: canConfirm() ? 'pointer' : 'not-allowed',
            fontWeight: 700
          }}
        >
          Xác nhận
        </button>
      </div>
    </div>
  )
}
