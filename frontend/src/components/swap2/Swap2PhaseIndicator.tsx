/**
 * Swap2PhaseIndicator Component
 * 
 * Displays current Swap 2 phase, active player, and stone count.
 * Requirements: 5.1, 5.2, 5.4
 */

import { memo, useMemo } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import type { Swap2Phase } from '../../types/swap2'

interface Swap2PhaseIndicatorProps {
  phase: Swap2Phase
  activePlayerName: string
  isCurrentUserActive: boolean
  stonesPlaced: number
  stonesRequired: number
  timeRemaining?: number
}

const Swap2PhaseIndicator = memo(function Swap2PhaseIndicator({
  phase,
  activePlayerName,
  isCurrentUserActive,
  stonesPlaced,
  stonesRequired,
  timeRemaining
}: Swap2PhaseIndicatorProps) {
  const { t } = useLanguage()

  const phaseInfo = useMemo(() => {
    switch (phase) {
      case 'swap2_placement':
        return {
          title: t('swap2.placementPhase') || 'Đặt quân mở đầu',
          description: t('swap2.placementDesc') || 'Đặt 3 quân đầu tiên (2 đen + 1 trắng)',
          color: '#22D3EE',
          icon: '🎯'
        }
      case 'swap2_choice':
        return {
          title: t('swap2.choicePhase') || 'Chọn màu',
          description: t('swap2.choiceDesc') || 'Chọn màu hoặc đặt thêm quân',
          color: '#A78BFA',
          icon: '🎨'
        }
      case 'swap2_extra':
        return {
          title: t('swap2.extraPhase') || 'Đặt thêm quân',
          description: t('swap2.extraDesc') || 'Đặt thêm 2 quân (1 đen + 1 trắng)',
          color: '#F59E0B',
          icon: '➕'
        }
      case 'swap2_final_choice':
        return {
          title: t('swap2.finalChoicePhase') || 'Chọn màu cuối',
          description: t('swap2.finalChoiceDesc') || 'Chọn màu để bắt đầu',
          color: '#10B981',
          icon: '✨'
        }
      case 'complete':
        return {
          title: t('swap2.complete') || 'Hoàn tất',
          description: t('swap2.completeDesc') || 'Bắt đầu trận đấu',
          color: '#22C55E',
          icon: '✅'
        }
      default:
        return {
          title: 'Swap 2',
          description: '',
          color: '#64748B',
          icon: '🎮'
        }
    }
  }, [phase, t])
  const showStoneCount = phase === 'swap2_placement' || phase === 'swap2_extra'

  return (
    <div
      className="swap2-phase-indicator"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.95) 100%)',
        borderRadius: '16px',
        padding: '16px 20px',
        border: `2px solid ${phaseInfo.color}40`,
        boxShadow: `0 8px 32px rgba(0, 0, 0, 0.3), 0 0 20px ${phaseInfo.color}20`,
        minWidth: '280px'
      }}
    >
      {/* Phase Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '12px'
      }}>
        <span style={{ fontSize: '28px' }}>{phaseInfo.icon}</span>
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: phaseInfo.color,
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {phaseInfo.title}
          </h3>
          <p style={{
            margin: '4px 0 0',
            fontSize: '12px',
            color: '#94A3B8'
          }}>
            {phaseInfo.description}
          </p>
        </div>
      </div>

      {/* Active Player */}
      <div style={{
        background: isCurrentUserActive ? `${phaseInfo.color}20` : 'rgba(30, 41, 59, 0.6)',
        borderRadius: '10px',
        padding: '12px',
        marginBottom: showStoneCount ? '12px' : '0'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <span style={{
              fontSize: '11px',
              color: '#64748B',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              {t('swap2.activePlayer') || 'Lượt của'}
            </span>
            <div style={{
              fontSize: '14px',
              fontWeight: 600,
              color: isCurrentUserActive ? phaseInfo.color : '#E2E8F0',
              marginTop: '2px'
            }}>
              {activePlayerName}
              {isCurrentUserActive && (
                <span style={{
                  marginLeft: '8px',
                  fontSize: '12px',
                  color: phaseInfo.color,
                  fontWeight: 500
                }}>
                  ({t('swap2.yourTurn') || 'Lượt của bạn'})
                </span>
              )}
            </div>
          </div>
          
          {/* Timer */}
          {timeRemaining !== undefined && timeRemaining > 0 && (
            <div style={{
              background: timeRemaining <= 10 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(30, 41, 59, 0.8)',
              borderRadius: '8px',
              padding: '6px 12px',
              border: `1px solid ${timeRemaining <= 10 ? '#EF4444' : '#475569'}40`
            }}>
              <span style={{
                fontSize: '16px',
                fontWeight: 700,
                color: timeRemaining <= 10 ? '#EF4444' : '#E2E8F0',
                fontFamily: 'monospace'
              }}>
                {timeRemaining}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stone Count Progress */}
      {showStoneCount && (
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '12px',
              color: '#94A3B8'
            }}>
              {t('swap2.stoneCount') || 'Số quân đã đặt'}
            </span>
            <span style={{
              fontSize: '14px',
              fontWeight: 600,
              color: phaseInfo.color
            }}>
              {stonesPlaced} / {stonesRequired}
            </span>
          </div>
          
          {/* Progress Bar */}
          <div style={{
            height: '6px',
            background: 'rgba(30, 41, 59, 0.8)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${(stonesPlaced / stonesRequired) * 100}%`,
              background: `linear-gradient(90deg, ${phaseInfo.color}, ${phaseInfo.color}CC)`,
              borderRadius: '3px',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}
    </div>
  )
})

export default Swap2PhaseIndicator