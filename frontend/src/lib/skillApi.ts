// Skill System API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

export interface Skill {
  id: string
  skill_code: string
  name_vi: string
  name_en?: string
  description_vi: string
  description_en?: string
  category: 'attack' | 'defense' | 'utility' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  effect_type: string
  effect_params: Record<string, any>
  cooldown: number
  mana_cost: number
  icon_url?: string
  preview_animation?: string
  effect_color?: string
  is_starter: boolean
  user_level?: number
  times_used?: number
}

export interface Season {
  id: string
  season_number: number
  name: string
  name_en?: string
  start_date: string
  end_date: string
  is_active: boolean
  skill_pool: string[]
  theme_color: string
  banner_url?: string
}

export interface SkillCombo {
  id: string
  user_id: string
  season_id: string
  preset_slot: number
  preset_name: string
  skill_ids: string[]
  is_valid: boolean
  validation_errors?: string[]
  is_active: boolean
}

export interface SeasonTimeRemaining {
  days: number
  hours: number
  minutes: number
  total_seconds: number
}

export interface SkillTurnState {
  skills: Skill[]
  turn: number
  seed: string
  held_skill_ids?: string[]
  hold_cost?: number
  mana?: number
  effects?: any[]
  tick_changes?: any[]
  disabled?: Record<string, string>
}

// Get current season
export async function getCurrentSeason(): Promise<{ season: Season; time_remaining: SeasonTimeRemaining }> {
  const res = await fetch(`${API_URL}/api/seasons/current`)
  if (!res.ok) throw new Error('Failed to fetch current season')
  return res.json()
}

// Get skills for a season
export async function getSeasonSkills(seasonId?: string): Promise<Skill[]> {
  const url = seasonId 
    ? `${API_URL}/api/skills?season_id=${seasonId}`
    : `${API_URL}/api/skills`
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch skills')
  const data = await res.json()
  return data.skills
}

// Get user's unlocked skills
export async function getUserSkills(token: string): Promise<Skill[]> {
  const res = await fetch(`${API_URL}/api/user/skills`, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch user skills')
  const data = await res.json()
  return data.skills
}

// Get user's combos
export async function getUserCombos(token: string, seasonId?: string): Promise<SkillCombo[]> {
  const url = seasonId 
    ? `${API_URL}/api/user/combos?season_id=${seasonId}`
    : `${API_URL}/api/user/combos`
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch combos')
  const data = await res.json()
  return data.combos
}

// Save combo
export async function saveCombo(
  token: string,
  skillIds: string[],
  presetSlot: number = 1,
  presetName: string = 'Default',
  seasonId?: string
): Promise<{ success: boolean; combo?: SkillCombo; errors?: string[] }> {
  const res = await fetch(`${API_URL}/api/user/combos`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ skill_ids: skillIds, preset_slot: presetSlot, preset_name: presetName, season_id: seasonId })
  })
  return res.json()
}

// Set active combo
export async function setActiveCombo(token: string, presetSlot: number, seasonId?: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/api/user/combos/active`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ preset_slot: presetSlot, season_id: seasonId })
  })
  const data = await res.json()
  return data.success
}

// Get recommended combo
export async function getRecommendedCombo(playstyle: 'aggressive' | 'defensive' | 'balanced' = 'balanced'): Promise<{ skill_ids: string[]; skills: Skill[] }> {
  const res = await fetch(`${API_URL}/api/skills/recommended?playstyle=${playstyle}`)
  if (!res.ok) throw new Error('Failed to fetch recommended combo')
  return res.json()
}

// Get random skills for turn (in-game)
export async function getRandomSkillsForTurn(
  token: string,
  matchId: string,
  turnNumber: number,
  cooldownSkillIds: string[] = [],
  heldSkillIds: string[] = []
): Promise<SkillTurnState> {
  const res = await fetch(`${API_URL}/api/match/${matchId}/skill/random`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      match_id: matchId,
      turn_number: turnNumber,
      cooldown_skill_ids: cooldownSkillIds,
      held_skill_ids: heldSkillIds
    })
  })
  if (!res.ok) throw new Error('Failed to get random skills')
  return res.json()
}

// Skill icon mapping (emoji fallback)
export const SKILL_ICONS: Record<string, string> = {
  ATK_QUICK: '⚡', ATK_PUSH: '👊', ATK_MARK: '🎯', ATK_RUSH: '🏃',
  ATK_FOCUS: '🔥', ATK_CHAIN: '⛓️', ATK_SCOUT: '🔍', ATK_PRESSURE: '⏰',
  ATK_DOUBLE: '✌️', ATK_PIERCE: '🗡️', ATK_SNIPE: '🎯', ATK_BOMB: '💣',
  ATK_LIGHTNING: '⚡', ATK_POISON: '☠️', ATK_STEAL: '🦹', ATK_GRAVITY: '🌍',
  DEF_GUARD: '🛡️', DEF_BLOCK: '🚫', DEF_HEAL: '💚', DEF_DODGE: '💨',
  DEF_ANCHOR: '⚓', DEF_MIST: '🌫️', DEF_REFLECT: '🪞', DEF_FORTIFY: '🏰',
  DEF_SHIELD: '🛡️', DEF_WALL: '🧱', DEF_SWAP: '🔄', DEF_MIRROR: '🪞',
  DEF_CLONE: '👯',
  UTL_SCAN: '📡', UTL_PEEK: '👁️', UTL_SHUFFLE: '🎲', UTL_SAVE: '💾',
  UTL_BOOST: '🚀', UTL_DRAIN: '🩸', UTL_INSIGHT: '🔮', UTL_BALANCE: '⚖️',
  UTL_REVEAL: '👁️', UTL_UNDO: '↩️', UTL_FREEZE: '❄️', UTL_EXTEND: '⏱️',
  UTL_SCOUT: '🔍', UTL_TIMEWARP: '⏰',
  SPC_TELEPORT: '🌀', SPC_CLONE: '👯', SPC_VOID: '🕳️', SPC_DESTINY: '🔮'
}

// Rarity colors
export const RARITY_COLORS: Record<string, string> = {
  common: '#9CA3AF',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B'
}

// Category colors
export const CATEGORY_COLORS: Record<string, string> = {
  attack: '#EF4444',
  defense: '#22C55E',
  utility: '#3B82F6',
  special: '#F59E0B'
}


// Use skill in match (in-game)
export interface UseSkillResult {
  success: boolean
  message: string
  changes: any[]
  new_board_state?: any[][]
  mana?: number
  effects?: any[]
  disabled?: { cooldown: string[]; deck_lock: string[] }
  error?: string
}

export async function useSkillApi(
  token: string,
  matchId: string,
  skillId: string,
  boardState: any[][],
  context: Record<string, any>,
  turnNumber: number,
  cooldownSkillIds: string[] = []
): Promise<UseSkillResult> {
  const res = await fetch(`${API_URL}/api/match/${matchId}/skill/use`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      match_id: matchId,
      skill_id: skillId,
      board_state: boardState,
      context,
      turn_number: turnNumber,
      cooldown_skill_ids: cooldownSkillIds
    })
  })
  return res.json()
}

// Fallback local skills for offline/local mode (when API unavailable)
export interface LocalSkill {
  id: string
  skill_code: string
  name_vi: string
  name_en: string
  description_vi: string
  description_en: string
  category: 'attack' | 'defense' | 'utility' | 'special'
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  effect_type: string
  effect_params: Record<string, any>
  cooldown: number
  mana_cost: number
  is_starter: boolean
}

// Re-export LOCAL_SKILLS từ skillData.ts (có đầy đủ mana_cost)
import { LOCAL_SKILLS as SKILL_DATA_SKILLS, getLocalSkillById, getLocalSkillsByRarity, getStarterSkills as getStarterSkillsFromData, getRandomLocalSkills as getRandomFromData } from './skillData'

// Re-export với type LocalSkill
export const LOCAL_SKILLS: LocalSkill[] = SKILL_DATA_SKILLS

// Re-export helper functions
export { getLocalSkillById, getLocalSkillsByRarity }
export const getStarterSkillsFromDataFile = getStarterSkillsFromData

// Helper: Random 3 skills từ local pool (fallback for local mode)
export const getRandomLocalSkills = (count: number = 3, exclude: string[] = []): LocalSkill[] => {
  return getRandomFromData(count, exclude)
}

// Get skill icon (from skill_code or fallback)
export const getSkillIcon = (skill: Skill | LocalSkill): string => {
  if ('icon_url' in skill && skill.icon_url) return skill.icon_url
  // Map skill_code to emoji icons
  const iconMap: Record<string, string> = {
    SKL_001: '⚡', SKL_002: '🌪️', SKL_003: '🌍', SKL_004: '🌀', SKL_005: '🔥',
    SKL_006: '💧', SKL_007: '💨', SKL_008: '🔗', SKL_009: '⏪', SKL_010: '✨',
    SKL_011: '🛡️', SKL_012: '🌟', SKL_013: '🏰', SKL_014: '💚', SKL_015: '🤫',
    SKL_016: '💎', SKL_017: '🧱', SKL_018: '🛡️', SKL_019: '💪', SKL_020: '🔄',
    SKL_021: '🌫️', SKL_022: '📌', SKL_023: '🔓', SKL_024: '⬆️', SKL_025: '⏰',
    SKL_026: '🔀', SKL_027: '🤝', SKL_028: '💨', SKL_029: '⚔️', SKL_030: '😇',
    SKL_031: '👻', SKL_032: '💠', SKL_033: '⚖️', SKL_034: '🍀', SKL_035: '🚫',
    SKL_036: '🔥', SKL_037: '❄️', SKL_038: '🌿', SKL_039: '🪨', SKL_040: '⚙️',
    SKL_041: '🔥', SKL_042: '💧', SKL_043: '🌿', SKL_044: '🪨', SKL_045: '⚙️',
    SKL_046: '🎲', SKL_047: '💊', SKL_048: '🏃', SKL_049: '🪞', SKL_050: '👁️',
    SKL_051: '🔄', SKL_052: '🔒', SKL_053: '🦹', SKL_054: '☯️', SKL_055: '🌈',
    SKL_056: '🔮', SKL_057: '👼', SKL_058: '👤', SKL_059: '💥', SKL_060: '🌪️'
  }
  return iconMap[skill.skill_code] || SKILL_ICONS[skill.skill_code] || '❓'
}

// =====================================================
// API functions để load skill đã unlock từ database
// =====================================================

// Interface cho user skill từ database
export interface UserSkill {
  id: string
  user_id: string
  skill_id: string
  is_unlocked: boolean
  unlocked_at: string | null
  unlock_method: string | null
  current_level: number
  times_used: number
  skill?: Skill // Joined skill data
}

// Load danh sách skill đã unlock của user - query trực tiếp từ Supabase
export async function getUserUnlockedSkills(token: string): Promise<LocalSkill[]> {
  try {
    // Import supabase dynamically to avoid circular dependency
    const { supabase } = await import('./supabase')
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn('No user logged in, using starter skills')
      return LOCAL_SKILLS.filter(s => s.is_starter)
    }
    
    console.log('🔍 Loading unlocked skills for user:', user.id)
    
    // Query user_skills joined with skills
    const { data, error } = await supabase
      .from('user_skills')
      .select(`
        skill_id,
        is_unlocked,
        skills:skill_id (
          id,
          skill_code,
          name_vi,
          name_en,
          description_vi,
          description_en,
          category,
          rarity,
          effect_type,
          effect_params,
          cooldown,
          is_starter
        )
      `)
      .eq('user_id', user.id)
      .eq('is_unlocked', true)
    
    if (error) {
      console.error('Error querying user_skills:', error)
      return LOCAL_SKILLS.filter(s => s.is_starter)
    }
    
    console.log('📦 Raw user_skills data:', data)
    
    if (data && data.length > 0) {
      const skills = data
        .filter((row: any) => row.skills) // Filter out null joins
        .map((row: any) => {
          const s = row.skills
          // Lookup mana_cost from LOCAL_SKILLS (source of truth)
          const localSkill = LOCAL_SKILLS.find(ls => ls.id === s.id || ls.skill_code === s.skill_code)
          return {
            id: s.id,
            skill_code: s.skill_code,
            name_vi: s.name_vi,
            name_en: s.name_en || s.name_vi,
            description_vi: s.description_vi,
            description_en: s.description_en || s.description_vi,
            category: s.category,
            rarity: s.rarity,
            effect_type: s.effect_type,
            effect_params: s.effect_params || {},
            cooldown: s.cooldown,
            mana_cost: localSkill?.mana_cost ?? s.mana_cost ?? 5, // Fallback to 5 if not found
            is_starter: s.is_starter
          }
        })
      
      console.log('✅ Loaded', skills.length, 'unlocked skills')
      return skills.length > 0 ? skills : LOCAL_SKILLS.filter(s => s.is_starter)
    }
    
    console.log('⚠️ No unlocked skills found, using starter skills')
    return LOCAL_SKILLS.filter(s => s.is_starter)
  } catch (err) {
    console.error('Error fetching unlocked skills:', err)
    return LOCAL_SKILLS.filter(s => s.is_starter)
  }
}

// Get starter skills (free skills cho tất cả user)
export const getStarterSkills = (): LocalSkill[] => {
  return LOCAL_SKILLS.filter(s => s.is_starter)
}

// Get all skills by rarity
export const getSkillsByRarity = (rarity: 'common' | 'rare' | 'legendary'): LocalSkill[] => {
  return LOCAL_SKILLS.filter(s => s.rarity === rarity)
}
