/**
 * TentativeStoneDisplay Component
 * 
 * Displays stones placed during Swap 2 phase with visual distinction.
 * Stones are shown with a special indicator since their final color
 * is not yet determined.
 * 
 * Requirements: 5.2, 5.4
 */

import { memo } from 'react'
import type { TentativeStone } from '../../types/swap2'

interface TentativeStoneDisplayProps {
  stone: TentativeStone
  isLatest: boolean
  cellSize: number
}

const TentativeStoneDisplay = memo(function TentativeStoneDisplay({
  stone,
  isLatest,
  cellSize
}: TentativeStoneDisplayProps) {
  const stoneSize = Math.max(12, cellSize - 6)
  
  // Determine stone appearance based on placement order
  // In Swap 2: stones 1, 2, 4 are black; stones 3, 5 are white
  // Pattern: B, B, W for first 3; then B, W for extra 2
  const isBlackPattern = stone.placementOrder <= 2 || stone.placementOrder === 4
  
  return (
    <div
      className="tentative-stone"
      style={{
        width: `${stoneSize}px`,
        height: `${stoneSize}px`,
        borderRadius: '50%',
        position: 'relative',
        zIndex: 10,
        // Stone gradient
        background: isBlackPattern
          ? 'radial-gradient(circle at 35% 35%, #666, #000)'
          : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
        // Shadow
        boxShadow: isBlackPattern
          ? '0 3px 6px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.4)'
          : '0 3px 6px rgba(0,0,0,0.3), inset 0 -2px 4px rgba(0,0,0,0.15)',
        // Latest stone highlight
        border: isLatest 
          ? `3px solid ${isBlackPattern ? '#3b82f6' : '#ef4444'}`
          : '2px dashed rgba(148, 163, 184, 0.5)',
        // Animation
        animation: isLatest ? 'tentativePlacement 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
      }}
    >
      {/* Tentative indicator - question mark or number */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.max(10, stoneSize * 0.4)}px`,
          fontWeight: 700,
          color: isBlackPattern ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
          textShadow: isBlackPattern 
            ? '0 1px 2px rgba(0,0,0,0.5)' 
            : '0 1px 2px rgba(255,255,255,0.5)'
        }}
      >
        {stone.placementOrder}
      </div>

      {/* Pulsing ring for latest stone */}
      {isLatest && (
        <div
          style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '50%',
            border: `2px solid ${isBlackPattern ? '#3b82f6' : '#ef4444'}`,
            animation: 'tentativePulse 1.5s ease infinite',
            opacity: 0.6
          }}
        />
      )}

      <style>{`
        @keyframes tentativePlacement {
          0% { transform: scale(0) rotate(0deg); opacity: 0; }
          50% { transform: scale(1.15) rotate(180deg); }
          100% { transform: scale(1) rotate(360deg); opacity: 1; }
        }
        
        @keyframes tentativePulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 0.3; }
        }
      `}</style>
    </div>
  )
})

export default TentativeStoneDisplay

/**
 * TentativeStoneOverlay Component
 * 
 * Overlay component to render all tentative stones on the game board.
 * This is used during Swap 2 phase to show stones with their placement order.
 */
interface TentativeStoneOverlayProps {
  stones: TentativeStone[]
  cellSize: number
  boardPadding?: number
}

export function TentativeStoneOverlay({
  stones,
  cellSize,
  boardPadding = 8
}: TentativeStoneOverlayProps) {
  if (stones.length === 0) return null

  const latestOrder = Math.max(...stones.map(s => s.placementOrder))

  return (
    <div
      className="tentative-stones-overlay"
      style={{
        position: 'absolute',
        top: boardPadding,
        left: boardPadding,
        pointerEvents: 'none'
      }}
    >
      {stones.map((stone) => (
        <div
          key={`tentative-${stone.x}-${stone.y}`}
          style={{
            position: 'absolute',
            left: `${stone.x * cellSize}px`,
            top: `${stone.y * cellSize}px`,
            width: `${cellSize}px`,
            height: `${cellSize}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <TentativeStoneDisplay
            stone={stone}
            isLatest={stone.placementOrder === latestOrder}
            cellSize={cellSize}
          />
        </div>
      ))}
    </div>
  )
}

/**
 * TentativeStoneLegend Component
 * 
 * Shows a legend explaining the tentative stone colors during Swap 2.
 */
interface TentativeStoneLegendProps {
  stoneCount: number
}

export function TentativeStoneLegend({ stoneCount }: TentativeStoneLegendProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '8px 16px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '10px',
        fontSize: '12px',
        color: '#94A3B8'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #666, #000)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
          }}
        />
        <span>Đen (1, 2{stoneCount > 3 ? ', 4' : ''})</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        />
        <span>Trắng (3{stoneCount > 3 ? ', 5' : ''})</span>
      </div>
    </div>
  )
}
