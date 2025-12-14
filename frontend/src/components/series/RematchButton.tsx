/**
 * RematchButton Component
 * 
 * Button to request a rematch after a series ends
 * Requirements: 10.1 - WHEN series ends THEN the system SHALL display "Rematch" button to both players
 */

import { useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface RematchButtonProps {
  /** Callback when rematch is requested */
  onRematch: () => void
  /** Whether the button is disabled */
  disabled?: boolean
  /** Size variant */
  size?: 'small' | 'medium' | 'large'
  /** Whether to show full width */
  fullWidth?: boolean
}

export default function RematchButton({
  onRematch,
  disabled = false,
  size = 'medium',
  fullWidth = false
}: RematchButtonProps) {
  const { t } = useLanguage()
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)

  // Size configurations
  const sizeConfig = {
    small: {
      padding: '8px 16px',
      fontSize: '13px',
      iconSize: '14px',
      gap: '6px'
    },
    medium: {
      padding: '12px 24px',
      fontSize: '15px',
      iconSize: '16px',
      gap: '8px'
    },
    large: {
      padding: '16px 32px',
      fontSize: '17px',
      iconSize: '20px',
      gap: '10px'
    }
  }

  const config = sizeConfig[size]

  const handleClick = () => {
    if (!disabled) {
      onRematch()
    }
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false)
        setIsPressed(false)
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: config.gap,
        padding: config.padding,
        fontSize: config.fontSize,
        fontWeight: 700,
        borderRadius: '12px',
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: fullWidth ? '100%' : 'auto',
        background: disabled
          ? 'rgba(71, 85, 105, 0.3)'
          : isPressed
            ? 'linear-gradient(135deg, #0891B2 0%, #0369A1 100%)'
            : isHovered
              ? 'linear-gradient(135deg, #06B6D4 0%, #0284C7 100%)'
              : 'linear-gradient(135deg, #22D3EE 0%, #0EA5E9 100%)',
        color: disabled ? '#64748B' : '#FFFFFF',
        boxShadow: disabled
          ? 'none'
          : isPressed
            ? '0 2px 8px rgba(34, 211, 238, 0.2)'
            : isHovered
              ? '0 8px 25px rgba(34, 211, 238, 0.4)'
              : '0 6px 20px rgba(34, 211, 238, 0.3)',
        transform: isPressed ? 'scale(0.98)' : isHovered ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s ease',
        opacity: disabled ? 0.6 : 1
      }}
    >
      <span style={{ fontSize: config.iconSize }}>🔄</span>
      <span>{t('series.rematch') || 'Đấu lại'}</span>
    </button>
  )
}
