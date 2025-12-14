/**
 * RankChangeAnimation Component
 * 
 * Displays an animated rank up/down notification
 * Requirements: 5.2 - WHEN player ranks up THEN the system SHALL display rank-up animation and notification
 * Requirements: 5.3 - WHEN player ranks down THEN the system SHALL display rank-down notification
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { Rank, RANK_DISPLAY, RANK_VALUES } from '../../../../shared/types/series'

interface RankChangeAnimationProps {
  /** Previous rank */
  oldRank: Rank
  /** New rank */
  newRank: Rank
  /** New MP value */
  newMP: number
  /** Callback when animation completes */
  onComplete: () => void
  /** Auto-dismiss delay in ms (default 4000) */
  autoDismissDelay?: number
}

export default function RankChangeAnimation({
  oldRank,
  newRank,
  newMP,
  onComplete,
  autoDismissDelay = 4000
}: RankChangeAnimationProps) {
  const { t, language } = useLanguage()
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter')

  const isRankUp = RANK_VALUES[newRank] > RANK_VALUES[oldRank]
  const oldRankDisplay = RANK_DISPLAY[oldRank]
  const newRankDisplay = RANK_DISPLAY[newRank]

  // Get localized rank name
  const getRankName = (rank: Rank) => {
    const display = RANK_DISPLAY[rank]
    return language === 'vi' ? display.nameVi : display.name
  }

  useEffect(() => {
    // Enter animation
    const enterTimer = setTimeout(() => setPhase('show'), 100)
    
    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      setPhase('exit')
    }, autoDismissDelay)

    // Complete callback
    const completeTimer = setTimeout(() => {
      onComplete()
    }, autoDismissDelay + 500)

    return () => {
      clearTimeout(enterTimer)
      clearTimeout(dismissTimer)
      clearTimeout(completeTimer)
    }
  }, [autoDismissDelay, onComplete])

  const handleClick = () => {
    setPhase('exit')
    setTimeout(onComplete, 500)
  }

  return (
    <div
      className="rank-change-overlay"
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: isRankUp 
          ? 'radial-gradient(ellipse at center, rgba(34, 197, 94, 0.3) 0%, rgba(0, 0, 0, 0.95) 70%)'
          : 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.3) 0%, rgba(0, 0, 0, 0.95) 70%)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10002,
        cursor: 'pointer',
        opacity: phase === 'enter' ? 0 : phase === 'exit' ? 0 : 1,
        transition: 'opacity 0.5s ease-out'
      }}
    >
      <div
        className="rank-change-content"
        style={{
          textAlign: 'center',
          transform: phase === 'show' ? 'scale(1)' : 'scale(0.8)',
          opacity: phase === 'show' ? 1 : 0,
          transition: 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        {/* Title */}
        <div style={{
          fontSize: '18px',
          color: '#94A3B8',
          textTransform: 'uppercase',
          letterSpacing: '4px',
          marginBottom: '20px',
          animation: phase === 'show' ? 'fadeInDown 0.6s ease-out' : 'none'
        }}>
          {isRankUp 
            ? (t('rank.rankUp') || 'Thăng Cấp!')
            : (t('rank.rankDown') || 'Giáng Cấp')}
        </div>

        {/* Old Rank */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '24px',
          opacity: 0.6,
          animation: phase === 'show' ? 'fadeIn 0.4s ease-out 0.2s both' : 'none'
        }}>
          <span style={{ fontSize: '32px' }}>{oldRankDisplay.icon}</span>
          <span style={{
            fontSize: '24px',
            color: oldRankDisplay.color,
            fontWeight: 600
          }}>
            {getRankName(oldRank)}
          </span>
        </div>

        {/* Arrow */}
        <div style={{
          fontSize: '48px',
          marginBottom: '24px',
          animation: phase === 'show' ? 'pulse 1s ease-in-out infinite' : 'none'
        }}>
          {isRankUp ? '⬆️' : '⬇️'}
        </div>

        {/* New Rank */}
        <div style={{
          animation: phase === 'show' ? 'zoomIn 0.6s ease-out 0.4s both' : 'none'
        }}>
          <div style={{
            fontSize: '80px',
            marginBottom: '12px',
            filter: `drop-shadow(0 0 30px ${newRankDisplay.color})`,
            animation: phase === 'show' ? 'glow 2s ease-in-out infinite' : 'none'
          }}>
            {newRankDisplay.icon}
          </div>
          <div style={{
            fontSize: '42px',
            fontWeight: 700,
            color: newRankDisplay.color,
            textShadow: `0 0 40px ${newRankDisplay.color}60`,
            letterSpacing: '2px'
          }}>
            {getRankName(newRank)}
          </div>
        </div>

        {/* New MP */}
        <div style={{
          marginTop: '32px',
          padding: '12px 24px',
          background: 'rgba(30, 41, 59, 0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(71, 85, 105, 0.4)',
          display: 'inline-block',
          animation: phase === 'show' ? 'fadeInUp 0.5s ease-out 0.6s both' : 'none'
        }}>
          <span style={{ color: '#64748B', fontSize: '14px' }}>MindPoint: </span>
          <span style={{ 
            color: '#22D3EE', 
            fontSize: '20px', 
            fontWeight: 700,
            fontFamily: 'monospace'
          }}>
            {newMP}
          </span>
        </div>

        {/* Click to continue hint */}
        <div style={{
          marginTop: '40px',
          fontSize: '13px',
          color: '#475569',
          animation: phase === 'show' ? 'fadeIn 0.5s ease-out 1s both' : 'none'
        }}>
          {t('common.clickToContinue') || 'Nhấn để tiếp tục'}
        </div>
      </div>

      {/* Particles for rank up */}
      {isRankUp && phase === 'show' && (
        <div className="particles" style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none'
        }}>
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '8px',
                height: '8px',
                background: newRankDisplay.color,
                borderRadius: '50%',
                animation: `particle ${2 + Math.random() * 2}s ease-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
                opacity: 0.6
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes zoomIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes glow {
          0%, 100% { filter: drop-shadow(0 0 30px ${newRankDisplay.color}); }
          50% { filter: drop-shadow(0 0 50px ${newRankDisplay.color}); }
        }
        @keyframes particle {
          0% { transform: translateY(0) scale(1); opacity: 0.6; }
          100% { transform: translateY(-100vh) scale(0); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
