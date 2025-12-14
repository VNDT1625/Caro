/**
 * GameNumberBadge Component
 * 
 * Displays the current game number within a series (e.g., "Game 2 of 3")
 * Requirements: 8.2 - WHEN in a series THEN the system SHALL display current game number
 */

import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface GameNumberBadgeProps {
  /** Current game number (1, 2, or 3) */
  currentGame: number
  /** Total games possible in series (default 3 for BO3) */
  totalGames?: number
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Show as compact badge or full text */
  compact?: boolean
}

export default function GameNumberBadge({
  currentGame,
  totalGames = 3,
  size = 'medium',
  compact = false
}: GameNumberBadgeProps) {
  const { t } = useLanguage()

  const sizeStyles = {
    small: {
      padding: '2px 8px',
      fontSize: '10px',
      borderRadius: '4px'
    },
    medium: {
      padding: '4px 12px',
      fontSize: '12px',
      borderRadius: '6px'
    },
    large: {
      padding: '6px 16px',
      fontSize: '14px',
      borderRadius: '8px'
    }
  }

  const styles = sizeStyles[size]

  // Get game status color
  const getStatusColor = () => {
    if (currentGame === 1) return { bg: 'rgba(34, 211, 238, 0.2)', border: 'rgba(34, 211, 238, 0.5)', text: '#22D3EE' }
    if (currentGame === 2) return { bg: 'rgba(251, 191, 36, 0.2)', border: 'rgba(251, 191, 36, 0.5)', text: '#FBB724' }
    return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#EF4444' } // Game 3 - decisive
  }

  const colors = getStatusColor()

  // Localized text
  const gameText = t('series.game') || 'Game'
  const ofText = t('series.of') || 'of'

  const displayText = compact 
    ? `${currentGame}/${totalGames}`
    : `${gameText} ${currentGame} ${ofText} ${totalGames}`

  return (
    <div
      className="game-number-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        ...styles
      }}
    >
      {compact ? (
        <>
          <span style={{ marginRight: '4px' }}>🎮</span>
          {displayText}
        </>
      ) : (
        displayText
      )}
    </div>
  )
}
