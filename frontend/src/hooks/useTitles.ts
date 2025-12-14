import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  Title,
  UserTitle,
  TitleStats,
  getAllTitles,
  getUserTitles,
  getEquippedTitle,
  equipTitle,
  unequipTitle,
  getTitleStats,
  groupTitlesByCategory
} from '../lib/titleApi'

interface UseTitlesReturn {
  // Data
  allTitles: Title[]
  userTitles: UserTitle[]
  equippedTitle: UserTitle | null
  stats: TitleStats | null
  groupedTitles: Record<string, Title[]>
  
  // State
  loading: boolean
  error: string | null
  
  // Actions
  equip: (titleId: string) => Promise<boolean>
  unequip: () => Promise<boolean>
  refresh: () => Promise<void>
  
  // Helpers
  isUnlocked: (titleId: string) => boolean
  getUnlockedTitle: (titleId: string) => UserTitle | undefined
}

export function useTitles(userId?: string): UseTitlesReturn {
  const [allTitles, setAllTitles] = useState<Title[]>([])
  const [userTitles, setUserTitles] = useState<UserTitle[]>([])
  const [equippedTitle, setEquippedTitle] = useState<UserTitle | null>(null)
  const [stats, setStats] = useState<TitleStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Load all titles
      const titles = await getAllTitles()
      setAllTitles(titles)

      // Load user-specific data if userId provided
      if (userId) {
        const [userT, equipped, titleStats] = await Promise.all([
          getUserTitles(userId),
          getEquippedTitle(userId),
          getTitleStats(userId)
        ])
        setUserTitles(userT)
        setEquippedTitle(equipped)
        setStats(titleStats)
      }
    } catch (err: any) {
      console.error('Failed to load titles:', err)
      setError(err?.message || 'Failed to load titles')
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Equip title
  const equip = useCallback(async (titleId: string): Promise<boolean> => {
    if (!userId) return false

    const success = await equipTitle(userId, titleId)
    if (success) {
      await loadData()
    }
    return success
  }, [userId, loadData])

  // Unequip title
  const unequip = useCallback(async (): Promise<boolean> => {
    if (!userId) return false

    const success = await unequipTitle(userId)
    if (success) {
      setEquippedTitle(null)
    }
    return success
  }, [userId])

  // Check if title is unlocked
  const isUnlocked = useCallback((titleId: string): boolean => {
    return userTitles.some(ut => ut.title_id === titleId)
  }, [userTitles])

  // Get unlocked title data
  const getUnlockedTitle = useCallback((titleId: string): UserTitle | undefined => {
    return userTitles.find(ut => ut.title_id === titleId)
  }, [userTitles])

  // Group titles by category
  const groupedTitles = groupTitlesByCategory(allTitles)

  return {
    allTitles,
    userTitles,
    equippedTitle,
    stats,
    groupedTitles,
    loading,
    error,
    equip,
    unequip,
    refresh: loadData,
    isUnlocked,
    getUnlockedTitle
  }
}

/**
 * Hook để lấy danh hiệu đang trang bị của user khác (để hiển thị)
 */
export function useUserEquippedTitle(userId?: string) {
  const [title, setTitle] = useState<UserTitle | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setTitle(null)
      setLoading(false)
      return
    }

    setLoading(true)
    getEquippedTitle(userId)
      .then(setTitle)
      .finally(() => setLoading(false))
  }, [userId])

  return { title, loading }
}
