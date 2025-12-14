/**
 * InteractiveBoard - 15x15 game board with move highlighting
 * 
 * Features:
 * - 15x15 grid display
 * - Move number display
 * - Current move highlighting (pulsing animation)
 * - Best move highlighting (green border)
 * - Mistake highlighting (red border)
 * - Pattern cell highlighting when pattern is selected
 * - Alternative move preview on click
 * - Visual indicator for significant/critical moves
 * - Click to navigate to move
 * 
 * Requirements: 10.3, 10.4, 13.1, 13.3, 16.3, 17.5, 17.6
 */

import React, { useMemo, memo, useCallback, useState } from 'react'
import type { Move, BestMove, Mistake, Pattern, TimelineEntry } from '../../lib/analysisApi'

interface AlternativeMove {
  position: string
  x: number
  y: number
  score: number
  reason: string
  is_best?: boolean
}

interface InteractiveBoardProps {
  sequence: Move[]
  currentMoveIndex: number
  bestMove: BestMove | null
  mistakes: Mistake[]
  patterns?: Pattern[]
  timeline?: TimelineEntry[]
  alternatives?: AlternativeMove[]
  selectedPattern?: Pattern | null
  replayMode?: boolean
  replayBoardState?: Record<string, 'X' | 'O'>
  /** Suggested alternative move to highlight (e.g., from mistake's best_alternative) */
  suggestedMove?: { x: number; y: number } | null
  onCellClick?: (x: number, y: number) => void
  onMoveClick?: (moveIndex: number) => void
  onAlternativePreview?: (alt: AlternativeMove | null) => void
}

const BOARD_SIZE = 15

// Memoized component to prevent unnecessary re-renders - Requirements 16.3
const InteractiveBoard = memo(function InteractiveBoard({
  sequence,
  currentMoveIndex,
  bestMove,
  mistakes,
  patterns = [],
  timeline = [],
  alternatives = [],
  selectedPattern = null,
  replayMode = false,
  replayBoardState = {},
  suggestedMove = null,
  onCellClick,
  onMoveClick,
  onAlternativePreview
}: InteractiveBoardProps) {
  // State for alternative move preview - Requirements 10.3, 17.5
  const [previewAlt, setPreviewAlt] = useState<AlternativeMove | null>(null)

  // Build board state up to current move
  const boardState = useMemo(() => {
    if (replayMode && Object.keys(replayBoardState).length > 0) {
      return replayBoardState
    }
    
    const state: Record<string, { piece: 'X' | 'O'; moveIndex: number }> = {}
    const movesToShow = currentMoveIndex >= 0 ? sequence.slice(0, currentMoveIndex + 1) : []
    
    movesToShow.forEach((move, idx) => {
      const key = `${move.x}_${move.y}`
      state[key] = { piece: move.p, moveIndex: idx }
    })
    
    return state
  }, [sequence, currentMoveIndex, replayMode, replayBoardState])

  // Get mistake moves for highlighting
  const mistakeMoves = useMemo(() => {
    return new Set(mistakes.map(m => m.move - 1)) // Convert to 0-indexed
  }, [mistakes])

  // Get pattern cells for highlighting - Requirements 10.4, 17.6
  const patternCells = useMemo(() => {
    if (!selectedPattern) return new Set<string>()
    
    const cells = new Set<string>()
    selectedPattern.moves.forEach(moveNum => {
      const moveIdx = moveNum - 1 // Convert to 0-indexed
      if (moveIdx >= 0 && moveIdx < sequence.length) {
        const move = sequence[moveIdx]
        cells.add(`${move.x}_${move.y}`)
      }
    })
    return cells
  }, [selectedPattern, sequence])

  // Get significant/critical moves from timeline - Requirements 17.6
  const significantMoves = useMemo(() => {
    const significant = new Map<number, { isSignificant: boolean; isCritical: boolean }>()
    
    timeline.forEach((entry, idx) => {
      // Calculate evaluation change (simplified - check if score changed significantly)
      const prevEntry = idx > 0 ? timeline[idx - 1] : null
      const scoreChange = prevEntry ? Math.abs(entry.score - prevEntry.score) : 0
      
      // Mark as significant if change > 20, critical if > 50
      if (scoreChange > 20 || entry.category === 'blunder' || entry.category === 'excellent') {
        significant.set(idx, {
          isSignificant: scoreChange > 20 || entry.category === 'weak' || entry.category === 'good',
          isCritical: scoreChange > 50 || entry.category === 'blunder' || entry.category === 'excellent'
        })
      }
    })
    
    return significant
  }, [timeline])

  // Get alternative moves as a map for quick lookup - Requirements 10.3, 17.5
  const alternativeMap = useMemo(() => {
    const map = new Map<string, AlternativeMove>()
    alternatives.forEach(alt => {
      map.set(`${alt.x}_${alt.y}`, alt)
    })
    return map
  }, [alternatives])

  // Memoize mistake severity lookup
  const getMistakeSeverity = useCallback((moveIndex: number): string | null => {
    const mistake = mistakes.find(m => m.move - 1 === moveIndex)
    return mistake?.severity || null
  }, [mistakes])

  // Handle alternative preview - Requirements 10.3, 17.5
  const handleAltHover = useCallback((alt: AlternativeMove | null) => {
    setPreviewAlt(alt)
    onAlternativePreview?.(alt)
  }, [onAlternativePreview])

  const renderCell = (x: number, y: number) => {
    const key = `${x}_${y}`
    const cellData = boardState[key]
    const piece = typeof cellData === 'object' ? cellData.piece : cellData
    const moveIndex = typeof cellData === 'object' ? cellData.moveIndex : -1
    
    const isCurrentMove = moveIndex === currentMoveIndex && currentMoveIndex >= 0
    const isBestMove = bestMove && bestMove.x === x && bestMove.y === y && !piece
    const isSuggestedMove = suggestedMove && suggestedMove.x === x && suggestedMove.y === y
    const isMistake = moveIndex >= 0 && mistakeMoves.has(moveIndex)
    const mistakeSeverity = isMistake ? getMistakeSeverity(moveIndex) : null
    const isEmpty = !piece
    
    // Pattern highlighting - Requirements 10.4, 17.6
    const isPatternCell = patternCells.has(key)
    
    // Significant/Critical move indicators - Requirements 17.6
    const moveSignificance = moveIndex >= 0 ? significantMoves.get(moveIndex) : null
    const isSignificant = moveSignificance?.isSignificant || false
    const isCritical = moveSignificance?.isCritical || false
    
    // Alternative move preview - Requirements 10.3, 17.5
    const altMove = alternativeMap.get(key)
    const isAltMove = !!altMove && isEmpty
    const isPreviewingAlt = previewAlt && previewAlt.x === x && previewAlt.y === y

    const handleClick = () => {
      if (replayMode && isEmpty && onCellClick) {
        onCellClick(x, y)
      } else if (isAltMove && altMove) {
        // Show alternative move preview on click - Requirements 10.3
        handleAltHover(previewAlt === altMove ? null : altMove)
      } else if (moveIndex >= 0 && onMoveClick) {
        onMoveClick(moveIndex)
      }
    }

    // Determine border color
    let borderColor = 'transparent'
    let borderWidth = 2
    let boxShadow = 'none'
    
    if (isCurrentMove) {
      borderColor = '#38BDF8'
      borderWidth = 3
    } else if (isPreviewingAlt) {
      // Previewing alternative move
      borderColor = '#8B5CF6'
      borderWidth = 3
      boxShadow = '0 0 12px rgba(139, 92, 246, 0.6)'
    } else if (isSuggestedMove) {
      borderColor = '#10B981'
      borderWidth = 3
    } else if (isBestMove) {
      borderColor = '#22C55E'
      borderWidth = 2
    } else if (isPatternCell) {
      // Pattern cell highlighting - Requirements 10.4, 17.6
      borderColor = '#A855F7'
      borderWidth = 2
      boxShadow = '0 0 8px rgba(168, 85, 247, 0.4)'
    } else if (isMistake) {
      borderColor = mistakeSeverity === 'critical' ? '#EF4444' 
                  : mistakeSeverity === 'major' ? '#F97316' 
                  : '#FBBF24'
      borderWidth = 2
    } else if (isAltMove) {
      // Alternative move indicator
      borderColor = 'rgba(139, 92, 246, 0.5)'
      borderWidth = 2
    }

    // Background color
    let bgColor = 'rgba(148,163,184,0.08)'
    if (piece) {
      bgColor = piece === 'X' ? 'rgba(56,189,248,0.15)' : 'rgba(245,158,11,0.15)'
    }
    if (isPatternCell && piece) {
      bgColor = piece === 'X' ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.25)'
    }
    if (isPreviewingAlt) {
      bgColor = 'rgba(139, 92, 246, 0.2)'
    }

    return (
      <div
        key={key}
        onClick={handleClick}
        onMouseEnter={() => isAltMove && altMove && handleAltHover(altMove)}
        onMouseLeave={() => isAltMove && handleAltHover(null)}
        style={{
          width: '100%',
          aspectRatio: '1',
          background: bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 'clamp(10px, 2vw, 14px)',
          fontWeight: 700,
          color: piece === 'X' ? '#38BDF8' : piece === 'O' ? '#F59E0B' : 'rgba(148,163,184,0.25)',
          borderRadius: 3,
          position: 'relative',
          cursor: (replayMode && isEmpty) || moveIndex >= 0 || isAltMove ? 'pointer' : 'default',
          border: `${borderWidth}px solid ${borderColor}`,
          boxSizing: 'border-box',
          boxShadow,
          transition: 'all 0.15s',
          animation: isCurrentMove ? 'pulse 1.5s ease-in-out infinite' : 'none'
        }}
      >
        {/* Piece */}
        {piece && (
          <span style={{ 
            textShadow: piece === 'X' 
              ? '0 0 8px rgba(56,189,248,0.5)' 
              : '0 0 8px rgba(245,158,11,0.5)'
          }}>
            {piece}
          </span>
        )}

        {/* Alternative Move Preview - Requirements 10.3, 17.5 */}
        {isPreviewingAlt && !piece && (
          <span style={{
            fontSize: 'clamp(10px, 2vw, 14px)',
            fontWeight: 700,
            color: '#8B5CF6',
            opacity: 0.8,
            textShadow: '0 0 8px rgba(139, 92, 246, 0.5)'
          }}>
            {sequence[currentMoveIndex]?.p || 'X'}
          </span>
        )}

        {/* Move Number */}
        {moveIndex >= 0 && (
          <span style={{
            position: 'absolute',
            bottom: 1,
            right: 2,
            fontSize: 'clamp(7px, 1vw, 9px)',
            opacity: 0.7,
            color: '#CBD5E1'
          }}>
            {moveIndex + 1}
          </span>
        )}

        {/* Significant/Critical Move Indicator - Requirements 17.6 */}
        {(isSignificant || isCritical) && moveIndex >= 0 && (
          <span style={{
            position: 'absolute',
            top: -2,
            left: -2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: isCritical ? '#EF4444' : '#F97316',
            boxShadow: isCritical 
              ? '0 0 6px rgba(239, 68, 68, 0.8)' 
              : '0 0 4px rgba(249, 115, 22, 0.6)',
            animation: isCritical ? 'criticalPulse 1s ease-in-out infinite' : 'none'
          }} />
        )}

        {/* Best Move Indicator */}
        {isBestMove && (
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(8px, 1.5vw, 12px)',
            color: '#22C55E',
            opacity: 0.8
          }}>
            ★
          </span>
        )}

        {/* Alternative Move Indicator - Requirements 10.3, 17.5 */}
        {isAltMove && !isPreviewingAlt && (
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(8px, 1.5vw, 12px)',
            color: '#8B5CF6',
            opacity: 0.6
          }}>
            ◇
          </span>
        )}

        {/* Suggested Alternative Move Indicator - Brighter, pulsing */}
        {isSuggestedMove && (
          <span style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(14px, 2.5vw, 20px)',
            color: '#10B981',
            fontWeight: 700,
            textShadow: '0 0 12px rgba(16,185,129,1), 0 0 20px rgba(16,185,129,0.6)',
            animation: 'suggestedPulse 1s ease-in-out infinite',
            zIndex: 10,
            pointerEvents: 'none'
          }}>
            ★
          </span>
        )}

        {/* Pattern Cell Indicator - Requirements 10.4, 17.6 */}
        {isPatternCell && (
          <span style={{
            position: 'absolute',
            top: -2,
            right: -2,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: '#A855F7',
            boxShadow: '0 0 4px rgba(168, 85, 247, 0.6)'
          }} />
        )}

        {/* Replay Mode - Empty Cell Hover */}
        {replayMode && isEmpty && (
          <span style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(56,189,248,0.1)',
            borderRadius: 3,
            opacity: 0,
            transition: 'opacity 0.15s'
          }}
          className="hover-overlay"
          />
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Alternative Move Preview Tooltip - Requirements 10.3, 17.5 */}
      {previewAlt && (
        <div style={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(139, 92, 246, 0.5)',
          borderRadius: 8,
          padding: '8px 12px',
          zIndex: 100,
          minWidth: 200,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8,
            marginBottom: 4
          }}>
            <span style={{ 
              color: '#8B5CF6', 
              fontWeight: 700,
              fontSize: 14
            }}>
              {previewAlt.position}
            </span>
            <span style={{
              background: previewAlt.is_best ? 'rgba(34, 197, 94, 0.2)' : 'rgba(139, 92, 246, 0.2)',
              color: previewAlt.is_best ? '#22C55E' : '#8B5CF6',
              padding: '2px 6px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600
            }}>
              {previewAlt.score.toFixed(1)}
            </span>
            {previewAlt.is_best && (
              <span style={{ color: '#22C55E', fontSize: 12 }}>★ Best</span>
            )}
          </div>
          <div style={{ 
            color: '#94A3B8', 
            fontSize: 12,
            lineHeight: 1.4
          }}>
            {previewAlt.reason}
          </div>
        </div>
      )}

      {/* Board Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${BOARD_SIZE}, 1fr)`,
        gap: 1,
        background: 'rgba(30,41,59,0.8)',
        padding: 6,
        borderRadius: 8,
        border: '1px solid rgba(71,85,105,0.4)'
      }}>
        {Array.from({ length: BOARD_SIZE * BOARD_SIZE }).map((_, idx) => {
          const x = idx % BOARD_SIZE
          const y = Math.floor(idx / BOARD_SIZE)
          return renderCell(x, y)
        })}
      </div>

      {/* Coordinate Labels - Optional */}
      <div style={{
        position: 'absolute',
        bottom: -18,
        left: 6,
        right: 6,
        display: 'flex',
        justifyContent: 'space-around',
        fontSize: 9,
        color: '#64748B'
      }}>
        {Array.from({ length: BOARD_SIZE }).map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>

      {/* Legend for significant/critical moves - Requirements 17.6 */}
      {significantMoves.size > 0 && (
        <div style={{
          position: 'absolute',
          top: -24,
          right: 0,
          display: 'flex',
          gap: 12,
          fontSize: 10,
          color: '#64748B'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#F97316'
            }} />
            Quan trọng
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#EF4444'
            }} />
            Bước ngoặt
          </span>
        </div>
      )}

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(56,189,248,0.4); }
          50% { box-shadow: 0 0 0 4px rgba(56,189,248,0.2); }
        }
        @keyframes suggestedPulse {
          0%, 100% { 
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% { 
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.8;
          }
        }
        @keyframes criticalPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 1;
          }
          50% { 
            transform: scale(1.3);
            opacity: 0.7;
          }
        }
        .hover-overlay:hover {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  )
})

export default InteractiveBoard
