import React from 'react'
import { useUnreadCount } from '../../hooks/useNotifications'

interface InboxIconProps {
  className?: string
}

export const InboxIcon: React.FC<InboxIconProps> = ({ className = '' }) => {
  const { unreadCount } = useUnreadCount()

  return (
    <button
      onClick={() => { window.location.hash = '#inbox' }}
      className={`inbox-icon-btn ${className}`}
      title="Hộp thư"
      style={{
        position: 'relative',
        padding: '8px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(139, 92, 246, 0.35))'
        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))'
        e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Mail/Envelope Icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C4B5FD"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>

      {/* Unread Badge */}
      {unreadCount > 0 && (
        <span style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          background: 'linear-gradient(135deg, #F43F5E, #E11D48)',
          color: 'white',
          fontSize: '11px',
          fontWeight: 700,
          borderRadius: '10px',
          minWidth: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 5px',
          boxShadow: '0 2px 6px rgba(244, 63, 94, 0.5)'
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export default InboxIcon
