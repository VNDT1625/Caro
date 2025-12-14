/**
 * Rank System V2 Types
 * 
 * Hệ thống rank mới với sub-ranks và decay system
 */

// Các bậc rank chính
export type MainRank = 
  | 'vo_danh' 
  | 'tan_ky' 
  | 'hoc_ky' 
  | 'ky_lao' 
  | 'cao_ky' 
  | 'tam_ky' 
  | 'de_nhi' 
  | 'vo_doi'

// Sub-rank tiers
export type RankTier = 'so_ky' | 'trung_ky' | 'cao_ky' | 'vuot_cap'

// Rank levels (1-3)
export type RankLevel = 1 | 2 | 3

// Full rank info
export interface RankInfo {
  rank: MainRank
  tier: RankTier
  level: RankLevel
  totalPoints: number
  pointsInSubrank: number
  pointsToNext: number
  phase: 'low' | 'high'
}

// Rank display info
export interface RankDisplay {
  name: string
  nameVi: string
  icon: string
  color: string
  gradient: string
}

// Points per sub-rank
export const POINTS_PER_SUBRANK = 100

// Main rank display info
export const MAIN_RANK_DISPLAY: Record<MainRank, RankDisplay> = {
  vo_danh: {
    name: 'Nameless',
    nameVi: 'Vô Danh',
    icon: '🥉',
    color: '#94A3B8',
    gradient: 'linear-gradient(135deg, #64748B 0%, #94A3B8 100%)'
  },
  tan_ky: {
    name: 'Novice',
    nameVi: 'Tân Kỳ',
    icon: '🥈',
    color: '#A8A29E',
    gradient: 'linear-gradient(135deg, #78716C 0%, #A8A29E 100%)'
  },
  hoc_ky: {
    name: 'Apprentice',
    nameVi: 'Học Kỳ',
    icon: '🥇',
    color: '#FBBF24',
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)'
  },
  ky_lao: {
    name: 'Expert',
    nameVi: 'Kỳ Lão',
    icon: '💎',
    color: '#22D3EE',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #22D3EE 100%)'
  },
  cao_ky: {
    name: 'Master',
    nameVi: 'Cao Kỳ',
    icon: '🏆',
    color: '#A78BFA',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)'
  },
  tam_ky: {
    name: 'Grandmaster',
    nameVi: 'Tam Kỳ',
    icon: '👑',
    color: '#F472B6',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)'
  },
  de_nhi: {
    name: 'Champion',
    nameVi: 'Đệ Nhị',
    icon: '🌟',
    color: '#FB923C',
    gradient: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)'
  },
  vo_doi: {
    name: 'Legend',
    nameVi: 'Vô Đối',
    icon: '⭐',
    color: '#FACC15',
    gradient: 'linear-gradient(135deg, #EAB308 0%, #FACC15 100%)'
  }
}

// Tier display info
export const TIER_DISPLAY: Record<RankTier, { name: string; nameVi: string }> = {
  so_ky: { name: 'Early', nameVi: 'Sơ Kỳ' },
  trung_ky: { name: 'Mid', nameVi: 'Trung Kỳ' },
  cao_ky: { name: 'Late', nameVi: 'Cao Kỳ' },
  vuot_cap: { name: 'Transcend', nameVi: 'Vượt Cấp' }
}

// Rank order for comparison
export const RANK_ORDER: MainRank[] = [
  'vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 
  'cao_ky', 'tam_ky', 'de_nhi', 'vo_doi'
]

// Tier order
export const TIER_ORDER: RankTier[] = ['so_ky', 'trung_ky', 'cao_ky', 'vuot_cap']

/**
 * Get rank info from total points
 */
export function getRankFromPoints(points: number): RankInfo {
  const subRanksPerRank = 9 // 3 tiers × 3 levels
  const pointsPerRank = subRanksPerRank * POINTS_PER_SUBRANK // 900

  // Calculate main rank
  let rankIndex = Math.floor(points / pointsPerRank)
  rankIndex = Math.min(rankIndex, RANK_ORDER.length - 1)
  const rank = RANK_ORDER[rankIndex]

  // Points remaining in this rank
  const pointsInRank = points - (rankIndex * pointsPerRank)

  // Calculate tier and level
  const subRankIndex = Math.min(Math.floor(pointsInRank / POINTS_PER_SUBRANK), 8)
  const tierIndex = Math.floor(subRankIndex / 3)
  const level = ((subRankIndex % 3) + 1) as RankLevel

  const tiers: RankTier[] = ['so_ky', 'trung_ky', 'cao_ky']
  const tier = tiers[tierIndex] || 'so_ky'

  // Points in current sub-rank
  const pointsInSubrank = pointsInRank % POINTS_PER_SUBRANK
  const pointsToNext = POINTS_PER_SUBRANK - pointsInSubrank

  // Determine phase
  const isLowPhase = rankIndex <= 2 && tier !== 'vuot_cap'

  return {
    rank,
    tier,
    level,
    totalPoints: points,
    pointsInSubrank,
    pointsToNext,
    phase: isLowPhase ? 'low' : 'high'
  }
}

/**
 * Format rank for display
 */
export function formatRankDisplay(
  rank: MainRank, 
  tier: RankTier, 
  level: RankLevel,
  language: 'vi' | 'en' = 'vi'
): string {
  const rankDisplay = MAIN_RANK_DISPLAY[rank]
  const tierDisplay = TIER_DISPLAY[tier]
  
  const rankName = language === 'vi' ? rankDisplay.nameVi : rankDisplay.name
  const tierName = language === 'vi' ? tierDisplay.nameVi : tierDisplay.name

  // High phase ranks don't show tier/level
  const rankIndex = RANK_ORDER.indexOf(rank)
  if (rankIndex > 2 || tier === 'vuot_cap') {
    return rankName
  }

  return `${rankName} - ${tierName} ${level}`
}

/**
 * Compare two ranks
 * Returns: positive if a > b, negative if a < b, 0 if equal
 */
export function compareRanks(
  a: { rank: MainRank; tier: RankTier; level: RankLevel },
  b: { rank: MainRank; tier: RankTier; level: RankLevel }
): number {
  const rankDiff = RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
  if (rankDiff !== 0) return rankDiff

  const tierDiff = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  if (tierDiff !== 0) return tierDiff

  return a.level - b.level
}

/**
 * Check if rank changed
 */
export function hasRankChanged(
  oldRank: { rank: MainRank; tier: RankTier; level: RankLevel },
  newRank: { rank: MainRank; tier: RankTier; level: RankLevel }
): boolean {
  return compareRanks(oldRank, newRank) !== 0
}
