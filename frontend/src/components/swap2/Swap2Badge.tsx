import React from 'react'

interface Swap2BadgeProps {
  enabled: boolean
  mandatory?: boolean // For ranked mode
  size?: 'small' | 'medium'
}

/**
 * Badge component to display Swap 2 status in room info
 * Requirements: 4.5 - Show Swap 2 status clearly to joining players
 */
export function Swap2Badge({ enabled, mandatory = false, size = 'small' }: Swap2BadgeProps) {
  if (!enabled && !mandatory) {
    return null
  }

  const isSmall = size === 'small'
  
  return (
    <span
      className={`swap2-badge ${mandatory ? 'mandatory' : ''} ${isSmall ? 'small' : ''}`}
      title={mandatory 
        ? 'Swap 2 bắt buộc trong chế độ Rank' 
        : 'Swap 2 Opening - Luật mở đầu công bằng'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? '3px' : '4px',
        padding: isSmall ? '2px 6px' : '4px 8px',
        borderRadius: '4px',
        fontSize: isSmall ? '10px' : '11px',
        fontWeight: 600,
        background: mandatory 
          ? 'rgba(251, 191, 36, 0.15)' 
          : 'rgba(34, 211, 238, 0.15)',
        color: mandatory ? '#FBBF24' : '#22D3EE',
        border: `1px solid ${mandatory ? 'rgba(251, 191, 36, 0.3)' : 'rgba(34, 211, 238, 0.3)'}`,
        whiteSpace: 'nowrap'
      }}
    >
      <span style={{ fontSize: isSmall ? '10px' : '12px' }}>🔄</span>
      <span>Swap 2</span>
      {mandatory && <span style={{ fontSize: isSmall ? '8px' : '9px', opacity: 0.8 }}>(bắt buộc)</span>}
    </span>
  )
}

export default Swap2Badge
