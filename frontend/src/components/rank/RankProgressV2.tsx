/**
 * RankProgressV2 Component
 * 
 * Hiển thị progress bar tiến độ lên rank tiếp theo
 */

import { useLanguage } from '../../contexts/LanguageContext'
import {
  MainRank,
  RankTier,
  RankLevel,
  RankInfo,
  MAIN_RANK_DISPLAY,
  TIER_DISPLAY,
  RANK_ORDER,
  TIER_ORDER,
  POINTS_PER_SUBRANK,
  getRankFromPoints
} from '../../types/rankV2'

interface RankProgressV2Props {
  totalPoints: number
  showDetails?: boolean
  compact?: boolean
}

export default function RankProgressV2({
  totalPoints,
  showDetails = true,
  compact = false
}: RankProgressV2Props) {
  const { language, t } = useLanguage()
  
  const rankInfo = getRankFromPoints(totalPoints)
  const { rank, tier, level, pointsInSubrank, pointsToNext, phase } = rankInfo
  
  const rankDisplay = MAIN_RANK_DISPLAY[rank]
  const tierDisplay = TIER_DISPLAY[tier]
  
  const progress = (pointsInSubrank / POINTS_PER_SUBRANK) * 100
  
  // Get next rank info
  const getNextRankInfo = (): { rank: MainRank; tier: RankTier; level: RankLevel } | null => {
    const rankIndex = RANK_ORDER.indexOf(rank)
    const tierIndex = TIER_ORDER.indexOf(tier)
    
    // Already at max
    if (rank === 'vo_doi') return null
    
    // High phase - just show next main rank
    if (phase === 'high') {
      if (rankIndex < RANK_ORDER.length - 1) {
        return { rank: RANK_ORDER[rankIndex + 1], tier: 'so_ky', level: 1 }
      }
      return null
    }
    
    // Low phase - calculate next sub-rank
    if (level < 3) {
      return { rank, tier, level: (level + 1) as RankLevel }
    }
    
    if (tierIndex < 2) { // so_ky or trung_ky
      return { rank, tier: TIER_ORDER[tierIndex + 1] as RankTier, level: 1 }
    }
    
    // cao_ky level 3 -> next main rank
    if (rankIndex < RANK_ORDER.length - 1) {
      return { rank: RANK_ORDER[rankIndex + 1], tier: 'so_ky', level: 1 }
    }
    
    return null
  }
  
  const nextRank = getNextRankInfo()
  const nextRankDisplay = nextRank ? MAIN_RANK_DISPLAY[nextRank.rank] : null
  const nextTierDisplay = nextRank ? TIER_DISPLAY[nextRank.tier] : null

  const formatRankName = (r: MainRank, t: RankTier, l: RankLevel, isHigh: boolean) => {
    const rd = MAIN_RANK_DISPLAY[r]
    const td = TIER_DISPLAY[t]
    const rName = language === 'vi' ? rd.nameVi : rd.name
    const tName = language === 'vi' ? td.nameVi : td.name
    
    if (isHigh) return rName
    return `${rName} ${tName} ${l}`
  }

  if (compact) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            height: '6px',
            background: 'rgba(71, 85, 105, 0.4)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: rankDisplay.gradient,
              borderRadius: '3px',
              transition: 'width 0.5s ease-out'
            }} />
          </div>
        </div>
        <span style={{
          fontSize: '11px',
          color: '#94A3B8',
          fontFamily: 'monospace'
        }}>
          {pointsInSubrank}/{POINTS_PER_SUBRANK}
        </span>
      </div>
    )
  }

  return (
    <div className="rank-progress-v2" style={{
      background: 'rgba(15, 23, 42, 0.6)',
      borderRadius: '16px',
      padding: '20px',
      border: '1px solid rgba(71, 85, 105, 0.3)'
    }}>
      {/* Current Rank */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: rankDisplay.color
          }}>
            {formatRankName(rank, tier, level, phase === 'high')}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '12px',
        background: 'rgba(71, 85, 105, 0.4)',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: rankDisplay.gradient,
          borderRadius: '6px',
          transition: 'width 0.5s ease-out',
          boxShadow: `0 0 10px ${rankDisplay.color}60`
        }} />
      </div>

      {/* Progress Details */}
      {showDetails && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{
            fontSize: '13px',
            color: '#94A3B8'
          }}>
            {pointsInSubrank} / {POINTS_PER_SUBRANK}
          </span>
          <span style={{
            fontSize: '13px',
            color: rankDisplay.color,
            fontWeight: 600
          }}>
            {t('rank.pointsToNext') || 'Còn'} {pointsToNext} {t('rank.points') || 'điểm'}
          </span>
        </div>
      )}


    </div>
  )
}
