/**
 * ControlsBar - Top control bar for AI Analysis page
 * 
 * Features:
 * - Tier toggle (Basic/Pro) with usage indicators
 * - Analyze button with loading state
 * - Trial countdown display
 * - Close button
 * 
 * Requirements: 11.1-11.5, 16.3 (memoization)
 */

import React, { memo, useCallback, useMemo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { AnalysisTier, SubscriptionTier } from '../../lib/analysisApi'

interface ControlsBarProps {
  tier: AnalysisTier
  subscriptionTier: SubscriptionTier
  hasProAccess: boolean
  isTrialActive: boolean
  trialDaysLeft: number
  dailyUsage: { basic: number; pro: number }
  dailyRemaining: { basic: number; pro: number }
  analyzing: boolean
  selectedMatchId: string | null
  gameCount?: number
  gameIndex?: number
  onGameChange?: (index: number) => void
  onTierChange: (tier: AnalysisTier) => void
  onAnalyze: () => void
  onClose: () => void
  onUpgrade?: () => void
}

// Memoized component to prevent unnecessary re-renders - Requirements 16.3
const ControlsBar = memo(function ControlsBar({
  tier,
  subscriptionTier,
  hasProAccess,
  isTrialActive,
  trialDaysLeft,
  dailyUsage,
  dailyRemaining,
  analyzing,
  selectedMatchId,
  gameCount = 1,
  gameIndex = 0,
  onGameChange,
  onTierChange,
  onAnalyze,
  onClose,
  onUpgrade
}: ControlsBarProps) {
  const { t } = useLanguage()

  // Memoize tier click handler
  const handleTierClick = useCallback((newTier: AnalysisTier) => {
    if (newTier === 'pro' && !hasProAccess) {
      onUpgrade?.()
      return
    }
    onTierChange(newTier)
  }, [hasProAccess, onUpgrade, onTierChange])

  // Memoize usage display strings
  const basicUsageDisplay = useMemo(() => 
    `${dailyRemaining.basic}/${dailyUsage.basic + dailyRemaining.basic}`,
    [dailyRemaining.basic, dailyUsage.basic]
  )

  const proUsageDisplay = useMemo(() => 
    `${dailyRemaining.pro}/${dailyUsage.pro + dailyRemaining.pro}`,
    [dailyRemaining.pro, dailyUsage.pro]
  )
  const remainingForTier = tier === 'pro' ? dailyRemaining.pro : dailyRemaining.basic
  const canAnalyze = !!selectedMatchId && !analyzing && remainingForTier > 0

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 16px',
      background: 'rgba(15,23,42,0.8)',
      borderRadius: 12,
      border: '1px solid rgba(71,85,105,0.4)',
      flexWrap: 'wrap'
    }}>
      {/* Tier Toggle */}
      <div style={{
        display: 'flex',
        background: 'rgba(30,41,59,0.6)',
        borderRadius: 8,
        padding: 4,
        gap: 4
      }}>
        <button
          onClick={() => handleTierClick('basic')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: tier === 'basic' ? 'linear-gradient(135deg, #38BDF8, #6366F1)' : 'transparent',
            color: tier === 'basic' ? '#fff' : '#94A3B8',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          Basic
          <span style={{ 
            marginLeft: 6, 
            fontSize: 10, 
            opacity: 0.8,
            background: 'rgba(0,0,0,0.2)',
            padding: '2px 6px',
            borderRadius: 4
          }}>
            {basicUsageDisplay}
          </span>
        </button>
        <button
          onClick={() => handleTierClick('pro')}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: 'none',
            background: tier === 'pro' ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : 'transparent',
            color: tier === 'pro' ? '#fff' : '#94A3B8',
            fontWeight: 600,
            fontSize: 13,
            cursor: hasProAccess ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            opacity: hasProAccess ? 1 : 0.6
          }}
        >
          Pro ✨
          {hasProAccess && (
            <span style={{ 
              marginLeft: 6, 
              fontSize: 10, 
              opacity: 0.8,
              background: 'rgba(0,0,0,0.2)',
              padding: '2px 6px',
              borderRadius: 4
            }}>
              {proUsageDisplay}
            </span>
          )}
        </button>
      </div>

      {/* Trial Countdown */}
      {isTrialActive && (
        <div style={{
          padding: '6px 12px',
          background: 'rgba(245,158,11,0.15)',
          border: '1px solid rgba(245,158,11,0.4)',
          borderRadius: 6,
          fontSize: 12,
          color: '#F59E0B',
          fontWeight: 500
        }}>
          🎁 Trial: {trialDaysLeft} ngày còn lại
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Game Selector (BO3) */}
      {gameCount > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginRight: 12,
          padding: '6px 10px',
          background: 'rgba(148,163,184,0.08)',
          borderRadius: 8,
          border: '1px solid rgba(148,163,184,0.25)',
          fontSize: 12,
          color: '#E2E8F0'
        }}>
          <span>Ván</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: gameCount }).map((_, idx) => {
              const active = idx === gameIndex
              return (
                <button
                  key={idx}
                  onClick={() => onGameChange?.(idx)}
                  style={{
                    minWidth: 28,
                    padding: '4px 6px',
                    borderRadius: 6,
                    border: active ? '1px solid #38BDF8' : '1px solid rgba(148,163,184,0.3)',
                    background: active ? 'rgba(56,189,248,0.2)' : 'transparent',
                    color: active ? '#38BDF8' : '#E2E8F0',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12
                  }}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <button
        onClick={onAnalyze}
        disabled={!canAnalyze}
        style={{
          padding: '10px 24px',
          borderRadius: 8,
          border: 'none',
          background: analyzing 
            ? 'rgba(56,189,248,0.3)' 
            : 'linear-gradient(135deg, #38BDF8, #6366F1)',
          color: '#fff',
          fontWeight: 600,
          fontSize: 14,
          cursor: canAnalyze ? 'pointer' : 'not-allowed',
          opacity: canAnalyze ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s'
        }}
      >
        {analyzing ? (
          <>
            <span style={{ 
              width: 16, 
              height: 16, 
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            {t('aiAnalysis.loading')}
          </>
        ) : (
          <>
            🔍 {t('aiAnalysis.analyzeButton')}
          </>
        )}
      </button>

      {/* Close Button */}
      <button
        onClick={onClose}
        style={{
          padding: '10px 16px',
          borderRadius: 8,
          background: 'rgba(71,85,105,0.4)',
          color: '#E2E8F0',
          fontWeight: 500,
          border: '1px solid rgba(71,85,105,0.6)',
          cursor: 'pointer',
          fontSize: 14,
          transition: 'all 0.2s'
        }}
      >
        ← {t('common.close')}
      </button>

      {/* Keyframe animation for spinner */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
})

export default ControlsBar
