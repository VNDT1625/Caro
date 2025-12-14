import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface ReportButtonProps {
  /** User ID of the person being reported */
  reportedUserId: string
  /** Optional match ID if reporting from a match context */
  matchId?: string
  /** Button variant: 'icon' for icon-only, 'text' for text button, 'full' for icon + text */
  variant?: 'icon' | 'text' | 'full'
  /** Optional custom className */
  className?: string
  /** Callback when report modal should open */
  onOpenReport: (reportedUserId: string, matchId?: string) => void
}

/**
 * ReportButton component - displays a button to report violations
 * Can be used in match view, profile view, or match history
 * Requirements: 8.1
 */
export default function ReportButton({
  reportedUserId,
  matchId,
  variant = 'full',
  className = '',
  onOpenReport
}: ReportButtonProps) {
  const { t } = useLanguage()

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onOpenReport(reportedUserId, matchId)
  }

  const buttonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: variant === 'icon' ? '8px' : '8px 14px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.15)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#EF4444',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: variant === 'icon' ? '36px' : 'auto',
    height: '36px'
  }

  const hoverStyle: React.CSSProperties = {
    background: 'rgba(239, 68, 68, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    transform: 'translateY(-1px)',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
  }

  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <button
      className={`report-button ${className}`}
      style={{ ...buttonStyle, ...(isHovered ? hoverStyle : {}) }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={t('report.buttonTitle') || 'Báo cáo vi phạm'}
      aria-label={t('report.buttonTitle') || 'Báo cáo vi phạm'}
    >
      <span style={{ fontSize: '16px' }}>🚩</span>
      {variant !== 'icon' && (
        <span>{t('report.button') || 'Báo cáo'}</span>
      )}
    </button>
  )
}
