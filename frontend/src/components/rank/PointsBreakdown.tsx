/**
 * PointsBreakdown Component
 * 
 * Hiển thị chi tiết cách tính điểm sau trận đấu
 */

import { useLanguage } from '../../contexts/LanguageContext'

interface PointsBreakdownProps {
  phase: 'low' | 'high'
  breakdown: {
    movePoints: number
    timePoints: number
    rankPoints?: number // Only for low phase
    baseBonus: number
    resultMultiplier: number
    rankMultiplier?: number // Only for high phase
    totalMoves: number
    timeRatio: number
    playerHigher?: boolean // Only for high phase
  }
  finalPoints: number
  isWin: boolean
}

export default function PointsBreakdown({
  phase,
  breakdown,
  finalPoints,
  isWin
}: PointsBreakdownProps) {
  const { t, language } = useLanguage()

  const getMoveLabel = (moves: number) => {
    if (moves < 10) return language === 'vi' ? 'Thắng nhanh' : 'Quick win'
    if (moves < 20) return language === 'vi' ? 'Bình thường' : 'Normal'
    return language === 'vi' ? 'Trận dài' : 'Long game'
  }

  const getTimeLabel = (ratio: number) => {
    if (ratio <= 0.5) return language === 'vi' ? 'Nhanh gấp đôi' : '2x faster'
    if (ratio <= 0.67) return language === 'vi' ? 'Nhanh hơn 1.5x' : '1.5x faster'
    return language === 'vi' ? 'Bình thường' : 'Normal'
  }

  const getRankLabel = (points: number) => {
    if (points === 10) return language === 'vi' ? 'Vô Danh' : 'Nameless'
    if (points === 7) return language === 'vi' ? 'Tân Kỳ' : 'Novice'
    return language === 'vi' ? 'Học Kỳ+' : 'Apprentice+'
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.8)',
      borderRadius: '12px',
      padding: '16px',
      border: '1px solid rgba(71, 85, 105, 0.3)'
    }}>
      <div style={{
        fontSize: '13px',
        color: '#64748B',
        marginBottom: '12px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      }}>
        {t('rank.pointsBreakdown') || 'Chi tiết điểm'}
      </div>

      {/* Formula display */}
      <div style={{
        background: 'rgba(30, 41, 59, 0.6)',
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#94A3B8'
      }}>
        {phase === 'low' ? (
          <span>
            ({breakdown.movePoints} + {breakdown.timePoints} + {breakdown.rankPoints} + {breakdown.baseBonus}) × {breakdown.resultMultiplier}
          </span>
        ) : (
          <span>
            ({breakdown.movePoints} + {breakdown.timePoints} + {breakdown.baseBonus}) × {breakdown.rankMultiplier}
          </span>
        )}
      </div>

      {/* Breakdown items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Move points */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(34, 211, 238, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(34, 211, 238, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡</span>
            <div>
              <div style={{ fontSize: '13px', color: '#F1F5F9' }}>
                {t('rank.movePoints') || 'Điểm lượt'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                {breakdown.totalMoves} {t('rank.moves') || 'nước'} - {getMoveLabel(breakdown.totalMoves)}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#22D3EE'
          }}>
            +{breakdown.movePoints}
          </span>
        </div>

        {/* Time points */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(139, 92, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(139, 92, 246, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⏱️</span>
            <div>
              <div style={{ fontSize: '13px', color: '#F1F5F9' }}>
                {t('rank.timePoints') || 'Điểm thời gian'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                {getTimeLabel(breakdown.timeRatio)}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#A78BFA'
          }}>
            +{breakdown.timePoints}
          </span>
        </div>

        {/* Rank points (low phase only) */}
        {phase === 'low' && breakdown.rankPoints !== undefined && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 12px',
            background: 'rgba(251, 191, 36, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(251, 191, 36, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎖️</span>
              <div>
                <div style={{ fontSize: '13px', color: '#F1F5F9' }}>
                  {t('rank.opponentRank') || 'Rank đối thủ'}
                </div>
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {getRankLabel(breakdown.rankPoints)}
                </div>
              </div>
            </div>
            <span style={{
              fontSize: '16px',
              fontWeight: 700,
              color: '#FBBF24'
            }}>
              +{breakdown.rankPoints}
            </span>
          </div>
        )}

        {/* Base bonus */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: 'rgba(71, 85, 105, 0.2)',
          borderRadius: '8px',
          border: '1px solid rgba(71, 85, 105, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>📊</span>
            <span style={{ fontSize: '13px', color: '#F1F5F9' }}>
              {t('rank.baseBonus') || 'Điểm cơ bản'}
            </span>
          </div>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: '#94A3B8'
          }}>
            +{breakdown.baseBonus}
          </span>
        </div>

        {/* Multiplier */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          background: isWin 
            ? 'rgba(34, 197, 94, 0.1)' 
            : 'rgba(239, 68, 68, 0.1)',
          borderRadius: '8px',
          border: `1px solid ${isWin ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isWin ? '🏆' : '💔'}</span>
            <div>
              <div style={{ fontSize: '13px', color: '#F1F5F9' }}>
                {phase === 'low' 
                  ? (t('rank.result') || 'Kết quả')
                  : (t('rank.rankDiff') || 'Chênh lệch rank')}
              </div>
              {phase === 'high' && (
                <div style={{ fontSize: '11px', color: '#64748B' }}>
                  {breakdown.playerHigher 
                    ? (t('rank.higherRank') || 'Bạn rank cao hơn')
                    : (t('rank.lowerRank') || 'Bạn rank thấp hơn')}
                </div>
              )}
            </div>
          </div>
          <span style={{
            fontSize: '16px',
            fontWeight: 700,
            color: isWin ? '#22C55E' : '#EF4444'
          }}>
            ×{phase === 'low' ? breakdown.resultMultiplier : breakdown.rankMultiplier}
          </span>
        </div>
      </div>

      {/* Final result */}
      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: finalPoints >= 0 
          ? 'rgba(34, 197, 94, 0.15)' 
          : 'rgba(239, 68, 68, 0.15)',
        borderRadius: '8px',
        border: `1px solid ${finalPoints >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#F1F5F9'
        }}>
          {t('rank.totalPoints') || 'Tổng điểm'}
        </span>
        <span style={{
          fontSize: '24px',
          fontWeight: 700,
          color: finalPoints >= 0 ? '#22C55E' : '#EF4444'
        }}>
          {finalPoints >= 0 ? '+' : ''}{finalPoints}
        </span>
      </div>
    </div>
  )
}
