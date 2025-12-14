/**
 * SeriesScoreDisplay Component
 * 
 * Displays the current series score prominently (e.g., "1 - 0")
 * Requirements: 8.1 - WHEN in a series THEN the system SHALL display series score prominently
 */

import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface SeriesScoreDisplayProps {
  /** Player 1 wins count */
  player1Wins: number
  /** Player 2 wins count */
  player2Wins: number
  /** Player 1 name/username */
  player1Name?: string
  /** Player 2 name/username */
  player2Name?: string
  /** Current user's player number (1 or 2) */
  currentPlayerNumber?: 1 | 2
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Show player names */
  showNames?: boolean
}

export default function SeriesScoreDisplay({
  player1Wins,
  player2Wins,
  player1Name = 'Player 1',
  player2Name = 'Player 2',
  currentPlayerNumber,
  size = 'medium',
  showNames = false
}: SeriesScoreDisplayProps) {
  const { t } = useLanguage()

  const sizeStyles = {
    small: {
      container: { padding: '4px 12px', gap: '8px' },
      score: { fontSize: '20px' },
      separator: { fontSize: '16px' },
      name: { fontSize: '10px' }
    },
    medium: {
      container: { padding: '8px 20px', gap: '12px' },
      score: { fontSize: '32px' },
      separator: { fontSize: '24px' },
      name: { fontSize: '12px' }
    },
    large: {
      container: { padding: '12px 28px', gap: '16px' },
      score: { fontSize: '48px' },
      separator: { fontSize: '36px' },
      name: { fontSize: '14px' }
    }
  }

  const styles = sizeStyles[size]

  const getScoreColor = (wins: number, isCurrentPlayer: boolean) => {
    if (wins >= 2) return '#22C55E' // Green for winner
    if (isCurrentPlayer) return '#22D3EE' // Cyan for current player
    return '#F59E0B' // Amber for opponent
  }

  return (
    <div
      className="series-score-display"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        borderRadius: '12px',
        border: '1px solid rgba(34, 211, 238, 0.3)',
        ...styles.container
      }}
    >
      {/* Player 1 Score */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {showNames && (
          <span style={{
            color: currentPlayerNumber === 1 ? '#22D3EE' : '#94A3B8',
            fontWeight: currentPlayerNumber === 1 ? 600 : 400,
            ...styles.name
          }}>
            {player1Name}
          </span>
        )}
        <span
          style={{
            color: getScoreColor(player1Wins, currentPlayerNumber === 1),
            fontWeight: 700,
            fontFamily: 'monospace',
            textShadow: player1Wins >= 2 ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none',
            ...styles.score
          }}
        >
          {player1Wins}
        </span>
      </div>

      {/* Separator */}
      <span
        style={{
          color: '#64748B',
          fontWeight: 300,
          ...styles.separator
        }}
      >
        -
      </span>

      {/* Player 2 Score */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {showNames && (
          <span style={{
            color: currentPlayerNumber === 2 ? '#22D3EE' : '#94A3B8',
            fontWeight: currentPlayerNumber === 2 ? 600 : 400,
            ...styles.name
          }}>
            {player2Name}
          </span>
        )}
        <span
          style={{
            color: getScoreColor(player2Wins, currentPlayerNumber === 2),
            fontWeight: 700,
            fontFamily: 'monospace',
            textShadow: player2Wins >= 2 ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none',
            ...styles.score
          }}
        >
          {player2Wins}
        </span>
      </div>
    </div>
  )
}
