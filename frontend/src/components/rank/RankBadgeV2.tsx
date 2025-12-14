/**
 * RankBadgeV2 Component
 * 
 * Hiển thị badge rank với sub-rank (tier + level)
 */

import { useLanguage } from '../../contexts/LanguageContext'
import {
  MainRank,
  RankTier,
  RankLevel,
  MAIN_RANK_DISPLAY,
  TIER_DISPLAY,
  RANK_ORDER,
  formatRankDisplay
} from '../../types/rankV2'

interface RankBadgeV2Props {
  rank: MainRank
  tier?: RankTier
  level?: RankLevel
  size?: 'small' | 'medium' | 'large'
  showTier?: boolean
  showIcon?: boolean
  animated?: boolean
}

export default function RankBadgeV2({
  rank,
  tier = 'so_ky',
  level = 1,
  size = 'medium',
  showTier = true,
  showIcon = true,
  animated = false
}: RankBadgeV2Props) {
  const { language } = useLanguage()
  
  const rankDisplay = MAIN_RANK_DISPLAY[rank]
  const tierDisplay = TIER_DISPLAY[tier]
  const rankIndex = RANK_ORDER.indexOf(rank)
  const isHighPhase = rankIndex > 2 || tier === 'vuot_cap'

  // Size configurations
  const sizes = {
    small: {
      padding: '4px 8px',
      fontSize: '11px',
      iconSize: '16px',
      gap: '5px',
      borderRadius: '6px'
    },
    medium: {
      padding: '6px 12px',
      fontSize: '13px',
      iconSize: '18px',
      gap: '6px',
      borderRadius: '8px'
    },
    large: {
      padding: '10px 16px',
      fontSize: '16px',
      iconSize: '24px',
      gap: '8px',
      borderRadius: '12px'
    }
  }

  const sizeConfig = sizes[size]
  const rankName = language === 'vi' ? rankDisplay.nameVi : rankDisplay.name
  const tierName = language === 'vi' ? tierDisplay.nameVi : tierDisplay.name

  return (
    <div
      className={`rank-badge-v2 ${animated ? 'animated' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: sizeConfig.gap,
        padding: sizeConfig.padding,
        background: rankDisplay.gradient,
        borderRadius: sizeConfig.borderRadius,
        boxShadow: `0 2px 8px ${rankDisplay.color}40`,
        animation: animated ? 'rankPulse 2s ease-in-out infinite' : 'none'
      }}
    >
      {showIcon && (
        <span style={{ 
          fontSize: sizeConfig.iconSize,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          filter: animated ? `drop-shadow(0 0 4px ${rankDisplay.color})` : 'none'
        }}>
          {rankDisplay.icon}
        </span>
      )}
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        lineHeight: 1.2,
        minHeight: showTier && !isHighPhase ? 'auto' : 'unset'
      }}>
        <span style={{
          fontSize: sizeConfig.fontSize,
          fontWeight: 700,
          color: '#FFFFFF',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap'
        }}>
          {rankName}
        </span>
        
        {showTier && !isHighPhase && (
          <span style={{
            fontSize: `calc(${sizeConfig.fontSize} * 0.8)`,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.85)',
            marginTop: '2px',
            whiteSpace: 'nowrap'
          }}>
            {tierName} {level}
          </span>
        )}
      </div>

      <style>{`
        @keyframes rankPulse {
          0%, 100% { 
            box-shadow: 0 2px 8px ${rankDisplay.color}40;
            transform: scale(1);
          }
          50% { 
            box-shadow: 0 4px 16px ${rankDisplay.color}60;
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  )
}
