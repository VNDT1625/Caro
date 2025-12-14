/**
 * PlayerSideIndicator Component
 * 
 * Displays which side (X or O) each player is playing
 * Requirements: 8.1, 8.2 - Display series information including player sides
 */

import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { PlayerSide } from '../../../../shared/types/series'

interface PlayerSideIndicatorProps {
  /** Player's assigned side */
  side: PlayerSide
  /** Player name/username */
  playerName?: string
  /** Whether this is the current user */
  isCurrentUser?: boolean
  /** Whether it's this player's turn */
  isActiveTurn?: boolean
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
}

export default function PlayerSideIndicator({
  side,
  playerName,
  isCurrentUser = false,
  isActiveTurn = false,
  size = 'medium',
  direction = 'horizontal'
}: PlayerSideIndicatorProps) {
  const { t } = useLanguage()

  const sizeStyles = {
    small: {
      symbol: { fontSize: '16px', width: '24px', height: '24px' },
      name: { fontSize: '10px' },
      container: { gap: '4px', padding: '4px 8px' }
    },
    medium: {
      symbol: { fontSize: '24px', width: '36px', height: '36px' },
      name: { fontSize: '12px' },
      container: { gap: '8px', padding: '6px 12px' }
    },
    large: {
      symbol: { fontSize: '32px', width: '48px', height: '48px' },
      name: { fontSize: '14px' },
      container: { gap: '12px', padding: '8px 16px' }
    }
  }

  const styles = sizeStyles[size]

  // Side colors
  const sideColors = {
    X: {
      bg: 'rgba(34, 211, 238, 0.15)',
      border: 'rgba(34, 211, 238, 0.4)',
      text: '#22D3EE',
      glow: 'rgba(34, 211, 238, 0.6)'
    },
    O: {
      bg: 'rgba(251, 191, 36, 0.15)',
      border: 'rgba(251, 191, 36, 0.4)',
      text: '#FBB724',
      glow: 'rgba(251, 191, 36, 0.6)'
    }
  }

  const colors = sideColors[side]

  return (
    <div
      className="player-side-indicator"
      style={{
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        alignItems: 'center',
        background: isActiveTurn ? colors.bg : 'rgba(0, 0, 0, 0.4)',
        border: `2px solid ${isActiveTurn ? colors.border : 'rgba(100, 116, 139, 0.3)'}`,
        borderRadius: '10px',
        transition: 'all 0.3s ease',
        boxShadow: isActiveTurn ? `0 0 15px ${colors.glow}` : 'none',
        ...styles.container
      }}
    >
      {/* Side Symbol */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isActiveTurn ? colors.bg : 'transparent',
          borderRadius: '8px',
          fontWeight: 700,
          color: isActiveTurn ? colors.text : '#64748B',
          transition: 'all 0.3s ease',
          ...styles.symbol
        }}
      >
        {side}
      </div>

      {/* Player Name */}
      {playerName && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: direction === 'vertical' ? 'center' : 'flex-start'
          }}
        >
          <span
            style={{
              color: isCurrentUser ? '#22D3EE' : '#E2E8F0',
              fontWeight: isCurrentUser ? 600 : 400,
              ...styles.name
            }}
          >
            {playerName}
            {isCurrentUser && (
              <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                ({t('series.you') || 'You'})
              </span>
            )}
          </span>
          
          {isActiveTurn && (
            <span
              style={{
                fontSize: '10px',
                color: colors.text,
                fontWeight: 500,
                marginTop: '2px'
              }}
            >
              {t('series.yourTurn') || 'Your turn'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
