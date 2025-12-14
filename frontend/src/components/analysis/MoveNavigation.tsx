/**
 * MoveNavigation - Move navigation controls with slider and playback
 * 
 * Features:
 * - Move slider for quick navigation
 * - Play/Pause controls for auto-play
 * - Speed control
 * - First/Last/Prev/Next buttons
 * - Keyboard shortcuts support
 * - Move score (0-10) with rating badge
 * - Color-coded moves by rating
 * - Role indicator (attacker/defender)
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 13.2, 16.3, 17.1, 17.2, 17.3, 17.4
 */

import React, { useEffect, useCallback, memo, useMemo } from 'react'
import type { MoveClassification } from '../../lib/analysisApi'

/**
 * Normalize raw score (0-100000) to display score (0-100)
 * Uses logarithmic scale for better distribution
 */
function normalizeScore(rawScore: number): number {
  if (rawScore <= 0) return Math.max(-100, rawScore / 1000)
  if (rawScore >= 100000) return 100
  // Logarithmic scale: log10(1) = 0, log10(100000) = 5
  // Map to 0-100 range
  return Math.min(100, Math.log10(rawScore + 1) * 20)
}

// Types for timeline entry data
interface TimelineEntry {
  move: number
  player: string
  position: { x: number; y: number }
  score: number
  win_prob: number
  category: MoveClassification
  note: string
  role?: 'attacker' | 'defender' | 'balanced'
}

interface MoveNavigationProps {
  currentMoveIndex: number
  totalMoves: number
  isPlaying: boolean
  playSpeed: number
  timeline?: TimelineEntry[]
  onSetMove: (index: number) => void
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onFirst: () => void
  onLast: () => void
  onSetSpeed: (speed: number) => void
  // i18n support
  t?: (key: string) => string
}

// Rating color mapping - Requirements 10.2, 17.2
const RATING_COLORS: Record<MoveClassification, { bg: string; text: string; border: string }> = {
  excellent: { bg: 'rgba(34, 197, 94, 0.2)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.5)' },
  good: { bg: 'rgba(59, 130, 246, 0.2)', text: '#3B82F6', border: 'rgba(59, 130, 246, 0.5)' },
  okay: { bg: 'rgba(156, 163, 175, 0.2)', text: '#9CA3AF', border: 'rgba(156, 163, 175, 0.5)' },
  weak: { bg: 'rgba(249, 115, 22, 0.2)', text: '#F97316', border: 'rgba(249, 115, 22, 0.5)' },
  blunder: { bg: 'rgba(239, 68, 68, 0.2)', text: '#EF4444', border: 'rgba(239, 68, 68, 0.5)' }
}

// Role icons and colors - Requirements 17.3, 17.4
const ROLE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  attacker: { icon: '⚔️', color: '#F97316', bg: 'rgba(249, 115, 22, 0.15)' },
  defender: { icon: '🛡️', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)' },
  balanced: { icon: '⚖️', color: '#9CA3AF', bg: 'rgba(156, 163, 175, 0.15)' }
}

// Default translation function
const defaultT = (key: string): string => {
  const translations: Record<string, string> = {
    'analysis.moveRating.excellent': 'Xuất sắc',
    'analysis.moveRating.good': 'Tốt',
    'analysis.moveRating.okay': 'Bình thường',
    'analysis.moveRating.weak': 'Yếu',
    'analysis.moveRating.blunder': 'Sai lầm',
    'analysis.role.attacker': 'Tấn công',
    'analysis.role.defender': 'Phòng thủ',
    'analysis.role.balanced': 'Cân bằng'
  }
  return translations[key] || key.split('.').pop() || key
}

// Memoized component to prevent unnecessary re-renders - Requirements 16.3
const MoveNavigation = memo(function MoveNavigation({
  currentMoveIndex,
  totalMoves,
  isPlaying,
  playSpeed,
  timeline = [],
  onSetMove,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onFirst,
  onLast,
  onSetSpeed,
  t = defaultT
}: MoveNavigationProps) {
  // Get current move data from timeline
  const currentMoveData = useMemo(() => {
    if (currentMoveIndex < 0 || !timeline.length) return null
    return timeline[currentMoveIndex] || null
  }, [currentMoveIndex, timeline])

  // Keyboard shortcuts - Requirements 10.4
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        onPrev()
        break
      case 'ArrowRight':
        e.preventDefault()
        onNext()
        break
      case ' ':
        e.preventDefault()
        isPlaying ? onPause() : onPlay()
        break
      case 'Home':
        e.preventDefault()
        onFirst()
        break
      case 'End':
        e.preventDefault()
        onLast()
        break
    }
  }, [isPlaying, onNext, onPrev, onPlay, onPause, onFirst, onLast])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Memoize slider background style with rating colors
  const sliderBackground = useMemo(() => {
    const progress = ((currentMoveIndex + 1) / totalMoves) * 100
    const ratingColor = currentMoveData?.category 
      ? RATING_COLORS[currentMoveData.category]?.text || '#38BDF8'
      : '#38BDF8'
    return `linear-gradient(to right, ${ratingColor} ${progress}%, rgba(71,85,105,0.4) ${progress}%)`
  }, [currentMoveIndex, totalMoves, currentMoveData])

  const buttonStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid rgba(71,85,105,0.4)',
    background: 'rgba(30,41,59,0.6)',
    color: '#E2E8F0',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    transition: 'all 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36
  }

  const activeButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    background: 'linear-gradient(135deg, #38BDF8, #6366F1)',
    borderColor: 'transparent'
  }

  // Get rating label - Requirements 10.1
  const getRatingLabel = (category: MoveClassification): string => {
    return t(`analysis.moveRating.${category}`)
  }

  // Get role label - Requirements 17.3
  const getRoleLabel = (role: string): string => {
    return t(`analysis.role.${role}`)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      padding: '12px 14px',
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 10,
      border: '1px solid rgba(71,85,105,0.35)'
    }}>
      {/* Move Counter with Score Badge - Requirements 10.1, 17.1 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: 13,
        color: '#94A3B8'
      }}>
        <span>Nước đi</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Move Score Badge - Requirements 10.1, 17.1 */}
          {currentMoveData && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              {/* Score (0-10) */}
              <span style={{
                fontWeight: 700,
                fontSize: 14,
                color: RATING_COLORS[currentMoveData.category]?.text || '#94A3B8',
                background: RATING_COLORS[currentMoveData.category]?.bg || 'rgba(71,85,105,0.3)',
                border: `1px solid ${RATING_COLORS[currentMoveData.category]?.border || 'rgba(71,85,105,0.4)'}`,
                padding: '2px 8px',
                borderRadius: 4,
                minWidth: 32,
                textAlign: 'center'
              }}>
                {currentMoveData.score.toFixed(1)}
              </span>
              
              {/* Rating Badge - Requirements 10.2, 17.2 */}
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: RATING_COLORS[currentMoveData.category]?.text || '#94A3B8',
                background: RATING_COLORS[currentMoveData.category]?.bg || 'rgba(71,85,105,0.3)',
                border: `1px solid ${RATING_COLORS[currentMoveData.category]?.border || 'rgba(71,85,105,0.4)'}`,
                padding: '2px 6px',
                borderRadius: 4,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                {getRatingLabel(currentMoveData.category)}
              </span>
            </div>
          )}
          
          {/* Move Number */}
          <span style={{ 
            fontWeight: 600, 
            color: '#F1F5F9',
            background: 'rgba(56,189,248,0.15)',
            padding: '2px 8px',
            borderRadius: 4
          }}>
            {currentMoveIndex + 1} / {totalMoves}
          </span>
        </div>
      </div>

      {/* Role Indicator - Requirements 17.3, 17.4 */}
      {currentMoveData?.role && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '6px 10px',
          background: ROLE_CONFIG[currentMoveData.role]?.bg || 'rgba(71,85,105,0.2)',
          borderRadius: 6,
          border: `1px solid ${ROLE_CONFIG[currentMoveData.role]?.color || '#64748B'}33`
        }}>
          <span style={{ fontSize: 14 }}>
            {ROLE_CONFIG[currentMoveData.role]?.icon || '⚖️'}
          </span>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            color: ROLE_CONFIG[currentMoveData.role]?.color || '#94A3B8'
          }}>
            {getRoleLabel(currentMoveData.role)}
          </span>
          <span style={{
            fontSize: 11,
            color: '#64748B',
            marginLeft: 4
          }}>
            ({currentMoveData.player})
          </span>
        </div>
      )}

      {/* Slider */}
      <input
        type="range"
        min={-1}
        max={totalMoves - 1}
        value={currentMoveIndex}
        onChange={(e) => onSetMove(parseInt(e.target.value))}
        style={{
          width: '100%',
          height: 6,
          borderRadius: 3,
          background: sliderBackground,
          appearance: 'none',
          cursor: 'pointer'
        }}
      />

      {/* Control Buttons */}
      <div style={{
        display: 'flex',
        gap: 6,
        justifyContent: 'center',
        flexWrap: 'wrap'
      }}>
        {/* First */}
        <button
          onClick={onFirst}
          style={buttonStyle}
          title="Đầu tiên (Home)"
        >
          ⏮
        </button>

        {/* Previous */}
        <button
          onClick={onPrev}
          style={buttonStyle}
          title="Trước (←)"
        >
          ◀
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          style={isPlaying ? activeButtonStyle : buttonStyle}
          title={isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}
        >
          {isPlaying ? '⏸' : '▶'}
        </button>

        {/* Next */}
        <button
          onClick={onNext}
          style={buttonStyle}
          title="Tiếp (→)"
        >
          ▶
        </button>

        {/* Last */}
        <button
          onClick={onLast}
          style={buttonStyle}
          title="Cuối cùng (End)"
        >
          ⏭
        </button>
      </div>

      {/* Speed Control */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: 12, color: '#64748B' }}>Tốc độ:</span>
        {[0.5, 1, 2, 4].map(speed => (
          <button
            key={speed}
            onClick={() => onSetSpeed(speed)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: 'none',
              background: playSpeed === speed 
                ? 'rgba(56,189,248,0.3)' 
                : 'rgba(71,85,105,0.3)',
              color: playSpeed === speed ? '#38BDF8' : '#94A3B8',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {speed}x
          </button>
        ))}
      </div>

      {/* Keyboard Hints */}
      <div style={{
        fontSize: 10,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4
      }}>
        ← → di chuyển • Space phát/dừng • Home/End đầu/cuối
      </div>

      {/* Custom slider thumb style */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${currentMoveData?.category ? RATING_COLORS[currentMoveData.category]?.text : '#38BDF8'};
          cursor: pointer;
          box-shadow: 0 0 8px ${currentMoveData?.category ? RATING_COLORS[currentMoveData.category]?.text + '80' : 'rgba(56,189,248,0.5)'};
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: ${currentMoveData?.category ? RATING_COLORS[currentMoveData.category]?.text : '#38BDF8'};
          cursor: pointer;
          border: none;
          box-shadow: 0 0 8px ${currentMoveData?.category ? RATING_COLORS[currentMoveData.category]?.text + '80' : 'rgba(56,189,248,0.5)'};
        }
      `}</style>
    </div>
  )
})

export default MoveNavigation
