import { useState, useCallback, useEffect } from 'react'
import { Skill, getRandomSkillsForTurn, getUserCombos } from '../lib/skillApi'
import { supabase } from '../lib/supabase'

interface SkillSystemState {
  // Current turn's available skills (3 random from combo)
  turnSkills: Skill[]
  // Cooldowns: skillId -> turns remaining
  cooldowns: Record<string, number>
  // User's combo skill IDs
  comboSkillIds: string[]
  // Loading state
  loading: boolean
  // Error
  error: string | null
  // Mana and effects from backend state
  mana: number
  effects: any[]
  disabled: Record<string, string>
  holdCost: number
  tickChanges: any[]
}

interface UseSkillSystemOptions {
  matchId: string
  enabled?: boolean
}

export function useSkillSystem({ matchId, enabled = true }: UseSkillSystemOptions) {
  const [state, setState] = useState<SkillSystemState>({
    turnSkills: [],
    cooldowns: {},
    comboSkillIds: [],
    loading: false,
    error: null,
    mana: 5, // Khởi đầu 5 mana theo spec
    effects: [],
    disabled: {},
    holdCost: 0,
    tickChanges: []
  })
  
  const [turnNumber, setTurnNumber] = useState(1)

  // Load user's combo on mount
  useEffect(() => {
    if (!enabled) return
    
    const loadCombo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return
        
        const combos = await getUserCombos(session.access_token)
        const activeCombo = combos.find(c => c.is_active)
        
        if (activeCombo) {
          setState(prev => ({ ...prev, comboSkillIds: activeCombo.skill_ids }))
        }
      } catch (err) {
        console.error('Failed to load skill combo:', err)
      }
    }
    
    loadCombo()
  }, [enabled])

  // Get random skills for current turn
  const refreshTurnSkills = useCallback(async (heldSkillIds: string[] = []) => {
    if (!enabled || !matchId) return
    
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }
      
      const cooldownIds = Object.entries(state.cooldowns)
        .filter(([_, cd]) => cd > 0)
        .map(([id]) => id)
      
      const result = await getRandomSkillsForTurn(
        session.access_token,
        matchId,
        turnNumber,
        cooldownIds,
        heldSkillIds
      )
      
      setState(prev => ({
        ...prev,
        turnSkills: result.skills,
        loading: false,
        mana: result.mana ?? prev.mana,
        effects: result.effects ?? [],
        disabled: result.disabled ?? {},
        holdCost: result.hold_cost ?? 0,
        tickChanges: result.tick_changes ?? []
      }))
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to get skills',
        loading: false
      }))
    }
  }, [enabled, matchId, turnNumber, state.cooldowns])

  // Use a skill
  const useSkill = useCallback((skill: Skill) => {
    if (state.disabled[skill.id]) {
      return null
    }
    setState(prev => ({
      ...prev,
      cooldowns: {
        ...prev.cooldowns,
        [skill.id]: skill.cooldown
      },
      turnSkills: [] // Clear turn skills after use
    }))
    
    return skill
  }, [state.disabled])

  // Skip skill selection
  const skipSkill = useCallback(() => {
    setState(prev => ({ ...prev, turnSkills: [] }))
  }, [])

  // Advance to next turn (reduce cooldowns)
  const nextTurn = useCallback(() => {
    setTurnNumber(prev => prev + 1)
    
    setState(prev => {
      const newCooldowns: Record<string, number> = {}
      Object.entries(prev.cooldowns).forEach(([id, cd]) => {
        if (cd > 1) newCooldowns[id] = cd - 1
      })
      return { ...prev, cooldowns: newCooldowns }
    })
  }, [])

  // Reset for new game
  const reset = useCallback(() => {
    setTurnNumber(1)
    setState(prev => ({
      ...prev,
      turnSkills: [],
      cooldowns: {},
      error: null
    }))
  }, [])

  return {
    ...state,
    turnNumber,
    refreshTurnSkills,
    useSkill,
    skipSkill,
    nextTurn,
    reset,
    hasSkillsToChoose: state.turnSkills.length > 0
  }
}
