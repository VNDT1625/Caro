/**
 * ScoreTimeline - Win probability chart over time
 * 
 * Features:
 * - Line chart showing win probability for each move
 * - Click to jump to specific move
 * - Current move indicator
 * - Color coding for X/O advantage
 * - Tooltip with move details on hover
 * - Significant moment markers (change > 20)
 * - Critical turning point indicators (change > 50)
 * 
 * Requirements: 6.3, 10.5, 13.4, 13.5, 16.3, 18.1, 18.4, 18.5, 18.6
 */

import React, { useMemo, useRef, memo, useCallback, useState } from 'react'
import type { TimelineEntry, MoveClassification } from '../../lib/analysisApi'

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

/**
 * Get score color based on normalized value
 */
function getScoreColor(normalizedScore: number): string {
  if (normalizedScore >= 75) return '#22C55E' // Green - excellent
  if (normalizedScore >= 50) return '#3B82F6' // Blue - good
  if (normalizedScore >= 25) return '#F59E0B' // Orange - okay
  if (normalizedScore >= 0) return '#F97316' // Dark orange - weak
  return '#EF4444' // Red - negative
}

interface ScoreTimelineProps {
  timeline: TimelineEntry[]
  currentMoveIndex: number
  onMoveClick: (moveIndex: number) => void
  // i18n support
  t?: (key: string) => string
}

// Rating color mapping
const RATING_COLORS: Record<MoveClassification, string> = {
  excellent: '#22C55E',
  good: '#3B82F6',
  okay: '#9CA3AF',
  weak: '#F97316',
  blunder: '#EF4444'
}

// Default translation function
const defaultT = (key: string): string => {
  const translations: Record<string, string> = {
    'analysis.moveRating.excellent': 'Xuất sắc',
    'analysis.moveRating.good': 'Tốt',
    'analysis.moveRating.okay': 'Bình thường',
    'analysis.moveRating.weak': 'Yếu',
    'analysis.moveRating.blunder': 'Sai lầm',
    'analysis.timeline.significant': 'Quan trọng',
    'analysis.timeline.critical': 'Bước ngoặt',
    'analysis.timeline.winProb': 'Xác suất thắng',
    'analysis.timeline.clickToJump': 'Click để nhảy đến nước đi'
  }
  return translations[key] || key.split('.').pop() || key
}

// Memoized component to prevent unnecessary re-renders - Requirements 16.3
const ScoreTimeline = memo(function ScoreTimeline({
  timeline,
  currentMoveIndex,
  onMoveClick,
  t = defaultT
}: ScoreTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredMove, setHoveredMove] = useState<number | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  // Calculate chart dimensions
  const chartHeight = 100
  const chartPadding = { top: 15, bottom: 25, left: 30, right: 10 }
  
  // Calculate significant and critical moves - Requirements 6.3, 18.4, 18.5, 18.6
  const moveAnalysis = useMemo(() => {
    const analysis: Map<number, { 
      isSignificant: boolean
      isCritical: boolean
      evalChange: number
    }> = new Map()
    
    timeline.forEach((entry, idx) => {
      const prevEntry = idx > 0 ? timeline[idx - 1] : null
      // Calculate evaluation change based on score difference
      const evalChange = prevEntry ? Math.abs(entry.score - prevEntry.score) : 0
      
      // Also consider category for significance
      const isCritical = evalChange > 50 || entry.category === 'blunder' || entry.category === 'excellent'
      const isSignificant = evalChange > 20 || entry.category === 'weak' || entry.category === 'good'
      
      if (isSignificant || isCritical) {
        analysis.set(idx, { isSignificant, isCritical, evalChange })
      }
    })
    
    return analysis
  }, [timeline])

  // Generate path data for the win probability line
  const pathData = useMemo(() => {
    if (timeline.length === 0) return ''
    
    const points = timeline.map((entry, idx) => {
      const x = chartPadding.left + (idx / Math.max(timeline.length - 1, 1)) * (100 - chartPadding.left - chartPadding.right)
      const y = chartPadding.top + (1 - entry.win_prob) * (chartHeight - chartPadding.top - chartPadding.bottom)
      return `${x},${y}`
    })
    
    return `M ${points.join(' L ')}`
  }, [timeline])

  // Generate area fill path
  const areaPath = useMemo(() => {
    if (timeline.length === 0) return ''
    
    const points = timeline.map((entry, idx) => {
      const x = chartPadding.left + (idx / Math.max(timeline.length - 1, 1)) * (100 - chartPadding.left - chartPadding.right)
      const y = chartPadding.top + (1 - entry.win_prob) * (chartHeight - chartPadding.top - chartPadding.bottom)
      return `${x},${y}`
    })
    
    const baseline = chartHeight - chartPadding.bottom
    const startX = chartPadding.left
    const endX = chartPadding.left + ((timeline.length - 1) / Math.max(timeline.length - 1, 1)) * (100 - chartPadding.left - chartPadding.right)
    
    return `M ${startX},${baseline} L ${points.join(' L ')} L ${endX},${baseline} Z`
  }, [timeline])

  // Calculate point positions for markers
  const pointPositions = useMemo(() => {
    return timeline.map((entry, idx) => ({
      x: chartPadding.left + (idx / Math.max(timeline.length - 1, 1)) * (100 - chartPadding.left - chartPadding.right),
      y: chartPadding.top + (1 - entry.win_prob) * (chartHeight - chartPadding.top - chartPadding.bottom),
      entry,
      idx
    }))
  }, [timeline])

  // Current move position
  const currentX = useMemo(() => {
    if (currentMoveIndex < 0 || timeline.length === 0) return null
    return chartPadding.left + (currentMoveIndex / Math.max(timeline.length - 1, 1)) * (100 - chartPadding.left - chartPadding.right)
  }, [currentMoveIndex, timeline.length])

  const currentY = useMemo(() => {
    if (currentMoveIndex < 0 || !timeline[currentMoveIndex]) return null
    return chartPadding.top + (1 - timeline[currentMoveIndex].win_prob) * (chartHeight - chartPadding.top - chartPadding.bottom)
  }, [currentMoveIndex, timeline])

  // Handle mouse move for tooltip - Requirements 10.5
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || timeline.length === 0) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    
    // Convert position to move index
    const chartWidth = 100 - chartPadding.left - chartPadding.right
    const relativeX = (clickX - chartPadding.left) / chartWidth
    const moveIndex = Math.round(relativeX * (timeline.length - 1))
    
    if (moveIndex >= 0 && moveIndex < timeline.length) {
      setHoveredMove(moveIndex)
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    } else {
      setHoveredMove(null)
      setTooltipPos(null)
    }
  }, [timeline.length])

  const handleMouseLeave = useCallback(() => {
    setHoveredMove(null)
    setTooltipPos(null)
  }, [])

  // Memoize click handler
  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || timeline.length === 0) return
    
    const rect = containerRef.current.getBoundingClientRect()
    const clickX = ((e.clientX - rect.left) / rect.width) * 100
    
    // Convert click position to move index
    const chartWidth = 100 - chartPadding.left - chartPadding.right
    const relativeX = (clickX - chartPadding.left) / chartWidth
    const moveIndex = Math.round(relativeX * (timeline.length - 1))
    
    if (moveIndex >= 0 && moveIndex < timeline.length) {
      onMoveClick(moveIndex)
    }
  }, [timeline.length, onMoveClick])

  const currentWinProb = currentMoveIndex >= 0 && timeline[currentMoveIndex] 
    ? timeline[currentMoveIndex].win_prob 
    : 0.5

  // Get hovered move data for tooltip
  const hoveredMoveData = hoveredMove !== null ? timeline[hoveredMove] : null
  const hoveredMoveAnalysis = hoveredMove !== null ? moveAnalysis.get(hoveredMove) : null

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 10,
      border: '1px solid rgba(71,85,105,0.35)',
      padding: '10px 12px',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#F1F5F9' }}>
          📈 {t('analysis.timeline.winProb')}
        </span>
        <div style={{
          display: 'flex',
          gap: 12,
          fontSize: 11
        }}>
          <span style={{ color: '#38BDF8' }}>
            X: {Math.round(currentWinProb * 100)}%
          </span>
          <span style={{ color: '#F59E0B' }}>
            O: {Math.round((1 - currentWinProb) * 100)}%
          </span>
        </div>
      </div>

      {/* Legend for significant/critical markers - Requirements 18.4, 18.5 */}
      {moveAnalysis.size > 0 && (
        <div style={{
          display: 'flex',
          gap: 12,
          fontSize: 10,
          color: '#64748B',
          marginBottom: 6
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#F97316',
              border: '1px solid rgba(249, 115, 22, 0.5)'
            }} />
            {t('analysis.timeline.significant')}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.5)',
              boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)'
            }} />
            {t('analysis.timeline.critical')}
          </span>
        </div>
      )}

      {/* Chart */}
      <div ref={containerRef} style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 100 ${chartHeight}`}
          style={{
            width: '100%',
            height: chartHeight,
            cursor: 'pointer'
          }}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Background grid */}
          <line 
            x1={chartPadding.left} 
            y1={chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) / 2} 
            x2={100 - chartPadding.right} 
            y2={chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) / 2}
            stroke="rgba(71,85,105,0.3)"
            strokeDasharray="2,2"
          />
          
          {/* 50% line label */}
          <text
            x={chartPadding.left - 3}
            y={chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) / 2}
            fontSize="6"
            fill="#64748B"
            textAnchor="end"
            dominantBaseline="middle"
          >
            50%
          </text>

          {/* Y-axis labels */}
          <text
            x={chartPadding.left - 3}
            y={chartPadding.top + 2}
            fontSize="6"
            fill="#38BDF8"
            textAnchor="end"
          >
            X
          </text>
          <text
            x={chartPadding.left - 3}
            y={chartHeight - chartPadding.bottom - 2}
            fontSize="6"
            fill="#F59E0B"
            textAnchor="end"
          >
            O
          </text>

          {/* Area fill */}
          {areaPath && (
            <path
              d={areaPath}
              fill="url(#areaGradient)"
              opacity={0.3}
            />
          )}

          {/* Line */}
          {pathData && (
            <path
              d={pathData}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Significant/Critical move markers - Requirements 18.4, 18.5, 18.6 */}
          {pointPositions.map(({ x, y, idx }) => {
            const analysis = moveAnalysis.get(idx)
            if (!analysis) return null
            
            const { isCritical, isSignificant } = analysis
            const color = isCritical ? '#EF4444' : '#F97316'
            const size = isCritical ? 4 : 3
            
            return (
              <g key={`marker-${idx}`}>
                {/* Marker circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={size}
                  fill={color}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="0.5"
                  style={{
                    filter: isCritical ? 'drop-shadow(0 0 3px rgba(239, 68, 68, 0.6))' : 'none'
                  }}
                />
                {/* Critical marker pulse animation */}
                {isCritical && (
                  <circle
                    cx={x}
                    cy={y}
                    r={size + 2}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.5"
                    opacity="0.5"
                  >
                    <animate
                      attributeName="r"
                      values={`${size};${size + 4};${size}`}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0;0.5"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
              </g>
            )
          })}

          {/* Hovered move indicator */}
          {hoveredMove !== null && pointPositions[hoveredMove] && (
            <>
              <line
                x1={pointPositions[hoveredMove].x}
                y1={chartPadding.top}
                x2={pointPositions[hoveredMove].x}
                y2={chartHeight - chartPadding.bottom}
                stroke="rgba(148,163,184,0.4)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <circle
                cx={pointPositions[hoveredMove].x}
                cy={pointPositions[hoveredMove].y}
                r="4"
                fill={RATING_COLORS[pointPositions[hoveredMove].entry.category] || '#94A3B8'}
                stroke="#fff"
                strokeWidth="1.5"
              />
            </>
          )}

          {/* Current move indicator */}
          {currentX !== null && currentY !== null && (
            <>
              <line
                x1={currentX}
                y1={chartPadding.top}
                x2={currentX}
                y2={chartHeight - chartPadding.bottom}
                stroke="rgba(56,189,248,0.4)"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <circle
                cx={currentX}
                cy={currentY}
                r="3"
                fill="#38BDF8"
                stroke="#fff"
                strokeWidth="1"
              />
            </>
          )}

          {/* Gradients */}
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
        </svg>

        {/* Tooltip - Requirements 10.5 */}
        {hoveredMoveData && tooltipPos && (
          <div style={{
            position: 'absolute',
            left: Math.min(tooltipPos.x, containerRef.current?.clientWidth ? containerRef.current.clientWidth - 180 : tooltipPos.x),
            top: tooltipPos.y - 80,
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid rgba(71, 85, 105, 0.5)',
            borderRadius: 8,
            padding: '8px 12px',
            zIndex: 100,
            minWidth: 160,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none'
          }}>
            {/* Move header */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              marginBottom: 6
            }}>
              <span style={{ 
                color: hoveredMoveData.player === 'X' ? '#38BDF8' : '#F59E0B',
                fontWeight: 700,
                fontSize: 13
              }}>
                #{hoveredMove! + 1} {hoveredMoveData.player}
              </span>
              <span style={{
                background: `${RATING_COLORS[hoveredMoveData.category]}20`,
                color: RATING_COLORS[hoveredMoveData.category],
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase'
              }}>
                {t(`analysis.moveRating.${hoveredMoveData.category}`)}
              </span>
              {hoveredMoveAnalysis?.isCritical && (
                <span style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#EF4444',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600
                }}>
                  {t('analysis.timeline.critical')}
                </span>
              )}
              {hoveredMoveAnalysis?.isSignificant && !hoveredMoveAnalysis?.isCritical && (
                <span style={{
                  background: 'rgba(249, 115, 22, 0.2)',
                  color: '#F97316',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600
                }}>
                  {t('analysis.timeline.significant')}
                </span>
              )}
            </div>
            
            {/* Score and win prob - normalized display */}
            <div style={{ 
              display: 'flex', 
              gap: 12,
              fontSize: 11,
              color: '#94A3B8',
              marginBottom: 4
            }}>
              <span>
                Điểm: <strong style={{ 
                  color: getScoreColor(normalizeScore(hoveredMoveData.score))
                }}>
                  {normalizeScore(hoveredMoveData.score).toFixed(0)}/100
                </strong>
              </span>
              <span>Win: <strong style={{ color: '#F1F5F9' }}>{Math.round(hoveredMoveData.win_prob * 100)}%</strong></span>
            </div>
            
            {/* Note */}
            {hoveredMoveData.note && (
              <div style={{ 
                fontSize: 11, 
                color: '#CBD5E1',
                lineHeight: 1.4,
                borderTop: '1px solid rgba(71, 85, 105, 0.3)',
                paddingTop: 4,
                marginTop: 4
              }}>
                {hoveredMoveData.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* X-axis labels */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 9,
        color: '#64748B',
        marginTop: 4,
        paddingLeft: chartPadding.left + '%',
        paddingRight: chartPadding.right + '%'
      }}>
        <span>1</span>
        <span>{Math.ceil(timeline.length / 2)}</span>
        <span>{timeline.length}</span>
      </div>

      {/* Hint */}
      <div style={{
        fontSize: 10,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 6
      }}>
        {t('analysis.timeline.clickToJump')}
      </div>
    </div>
  )
})

export default ScoreTimeline
