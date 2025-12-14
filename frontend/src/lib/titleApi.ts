import { supabase } from './supabase'

export interface Title {
  id: string
  name_vi: string
  name_en: string
  description_vi?: string
  description_en?: string
  category: 'rank' | 'wins' | 'streak' | 'special' | 'season' | 'social' | 'skill' | 'event'
  rarity: 'common' | 'rare' | 'epic' | 'legendary' | 'mythic'
  icon?: string
  color?: string
  glow_color?: string
  requirement_type: string
  requirement_value: Record<string, any>
  points: number
  sort_order: number
}

export interface UserTitle {
  id: string
  user_id: string
  title_id: string
  unlocked_at: string
  is_equipped: boolean
  titles?: Title
}

export interface TitleStats {
  total_unlocked: number
  total_available: number
  total_points: number
  by_rarity: Record<string, number>
  by_category: Record<string, number>
  completion_percent: number
}

/**
 * Lấy tất cả danh hiệu
 */
export async function getAllTitles(): Promise<Title[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch titles:', error)
    return []
  }

  return data || []
}

/**
 * Lấy danh hiệu theo category
 */
export async function getTitlesByCategory(category: string): Promise<Title[]> {
  const { data, error } = await supabase
    .from('titles')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .order('sort_order')

  if (error) {
    console.error('Failed to fetch titles by category:', error)
    return []
  }

  return data || []
}

/**
 * Lấy danh hiệu của user
 */
export async function getUserTitles(userId: string): Promise<UserTitle[]> {
  const { data, error } = await supabase
    .from('user_titles')
    .select('*, titles(*)')
    .eq('user_id', userId)
    .order('unlocked_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch user titles:', error)
    return []
  }

  return data || []
}

/**
 * Lấy danh hiệu đang trang bị
 */
export async function getEquippedTitle(userId: string): Promise<UserTitle | null> {
  const { data, error } = await supabase
    .from('user_titles')
    .select('*, titles(*)')
    .eq('user_id', userId)
    .eq('is_equipped', true)
    .maybeSingle()

  if (error) {
    console.error('Failed to fetch equipped title:', error)
    return null
  }

  return data
}

/**
 * Trang bị danh hiệu
 */
export async function equipTitle(userId: string, titleId: string): Promise<boolean> {
  // Bỏ trang bị tất cả
  await supabase
    .from('user_titles')
    .update({ is_equipped: false })
    .eq('user_id', userId)

  // Trang bị mới
  const { error } = await supabase
    .from('user_titles')
    .update({ is_equipped: true })
    .eq('user_id', userId)
    .eq('title_id', titleId)

  if (error) {
    console.error('Failed to equip title:', error)
    return false
  }

  return true
}

/**
 * Bỏ trang bị danh hiệu
 */
export async function unequipTitle(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_titles')
    .update({ is_equipped: false })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to unequip title:', error)
    return false
  }

  return true
}

/**
 * Mở khóa danh hiệu
 */
export async function unlockTitle(userId: string, titleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_titles')
    .upsert({
      user_id: userId,
      title_id: titleId,
      is_equipped: false
    }, { onConflict: 'user_id,title_id' })

  if (error) {
    console.error('Failed to unlock title:', error)
    return false
  }

  return true
}

/**
 * Lấy thống kê danh hiệu
 */
export async function getTitleStats(userId: string): Promise<TitleStats> {
  const [userTitles, allTitles] = await Promise.all([
    getUserTitles(userId),
    getAllTitles()
  ])

  let totalPoints = 0
  const byRarity: Record<string, number> = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }
  const byCategory: Record<string, number> = {}

  userTitles.forEach(ut => {
    const title = ut.titles
    if (title) {
      totalPoints += title.points || 0
      byRarity[title.rarity] = (byRarity[title.rarity] || 0) + 1
      byCategory[title.category] = (byCategory[title.category] || 0) + 1
    }
  })

  return {
    total_unlocked: userTitles.length,
    total_available: allTitles.length,
    total_points: totalPoints,
    by_rarity: byRarity,
    by_category: byCategory,
    completion_percent: allTitles.length > 0 
      ? Math.round(userTitles.length / allTitles.length * 1000) / 10 
      : 0
  }
}

/**
 * Group titles by category
 */
export function groupTitlesByCategory(titles: Title[]): Record<string, Title[]> {
  const grouped: Record<string, Title[]> = {}
  
  titles.forEach(title => {
    const cat = title.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(title)
  })

  return grouped
}

/**
 * Category display info
 */
export const TITLE_CATEGORIES = {
  rank: { icon: '🏆', name_vi: 'Hạng', name_en: 'Rank' },
  wins: { icon: '⚔️', name_vi: 'Chiến Thắng', name_en: 'Victories' },
  streak: { icon: '🔥', name_vi: 'Chuỗi Thắng', name_en: 'Streaks' },
  special: { icon: '✨', name_vi: 'Đặc Biệt', name_en: 'Special' },
  season: { icon: '🏁', name_vi: 'Mùa Giải', name_en: 'Season' },
  social: { icon: '🤝', name_vi: 'Xã Hội', name_en: 'Social' },
  skill: { icon: '🧠', name_vi: 'Kỹ Năng', name_en: 'Skill' },
  event: { icon: '🎉', name_vi: 'Sự Kiện', name_en: 'Event' }
}

/**
 * Rarity display info
 */
export const TITLE_RARITIES = {
  common: { color: '#9CA3AF', name_vi: 'Thường', name_en: 'Common' },
  rare: { color: '#3B82F6', name_vi: 'Hiếm', name_en: 'Rare' },
  epic: { color: '#8B5CF6', name_vi: 'Sử Thi', name_en: 'Epic' },
  legendary: { color: '#F59E0B', name_vi: 'Huyền Thoại', name_en: 'Legendary' },
  mythic: { color: '#EF4444', name_vi: 'Thần Thoại', name_en: 'Mythic' }
}
