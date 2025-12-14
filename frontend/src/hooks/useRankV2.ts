/**
 * useRankV2 Hook
 * 
 * Hook để quản lý và fetch dữ liệu rank V2
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  MainRank,
  RankTier,
  RankLevel,
  RankInfo,
  getRankFromPoints,
  hasRankChanged
} from '../types/rankV2'

interface RankV2Data {
  rank: MainRank
  tier: RankTier
  level: RankLevel
  totalPoints: number
  pointsInSubrank: number
  pointsToNext: number
  phase: 'low' | 'high'
  seasonMatches: number
  softDemoted: boolean
}

interface UseRankV2Options {
  userId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseRankV2Return {
  rankData: RankV2Data | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  previousRank: RankV2Data | null
  hasRankChanged: boolean
}

export function useRankV2(options: UseRankV2Options = {}): UseRankV2Return {
  const { userId, autoRefresh = false, refreshInterval = 30000 } = options

  const [rankData, setRankData] = useState<RankV2Data | null>(null)
  const [previousRank, setPreviousRank] = useState<RankV2Data | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRankData = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('mindpoint, current_rank')
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        throw fetchError
      }

      if (!data) {
        setRankData(null)
        return
      }

      const totalPoints = data.mindpoint || 0
      const rankInfo = getRankFromPoints(totalPoints)

      const newRankData: RankV2Data = {
        rank: (data.current_rank as MainRank) || rankInfo.rank,
        tier: rankInfo.tier,
        level: rankInfo.level,
        totalPoints,
        pointsInSubrank: rankInfo.pointsInSubrank,
        pointsToNext: rankInfo.pointsToNext,
        phase: rankInfo.phase,
        seasonMatches: 0,
        softDemoted: false
      }

      // Store previous rank for comparison
      if (rankData) {
        setPreviousRank(rankData)
      }

      setRankData(newRankData)
    } catch (err: any) {
      console.error('Failed to fetch rank data:', err)
      setError(err.message || 'Failed to fetch rank data')
    } finally {
      setIsLoading(false)
    }
  }, [userId, rankData])

  // Initial fetch
  useEffect(() => {
    fetchRankData()
  }, [userId])

  // Auto refresh
  useEffect(() => {
    if (!autoRefresh || !userId) return

    const interval = setInterval(fetchRankData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, userId, fetchRankData])

  // Subscribe to realtime updates
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`rank:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newData = payload.new as any
          if (newData.mindpoint !== undefined) {
            fetchRankData()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchRankData])

  // Check if rank changed
  const rankChanged = previousRank && rankData
    ? hasRankChanged(
        { rank: previousRank.rank, tier: previousRank.tier, level: previousRank.level },
        { rank: rankData.rank, tier: rankData.tier, level: rankData.level }
      )
    : false

  return {
    rankData,
    isLoading,
    error,
    refetch: fetchRankData,
    previousRank,
    hasRankChanged: rankChanged
  }
}

/**
 * Hook để lấy rank của một player khác (opponent)
 */
export function useOpponentRank(opponentId: string | null) {
  const [rankData, setRankData] = useState<RankV2Data | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!opponentId) {
      setRankData(null)
      return
    }

    const fetchOpponentRank = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('mindpoint, current_rank')
          .eq('user_id', opponentId)
          .single()

        if (error || !data) {
          setRankData(null)
          return
        }

        const totalPoints = data.mindpoint || 0
        const rankInfo = getRankFromPoints(totalPoints)

        setRankData({
          rank: (data.current_rank as MainRank) || rankInfo.rank,
          tier: rankInfo.tier,
          level: rankInfo.level,
          totalPoints,
          pointsInSubrank: rankInfo.pointsInSubrank,
          pointsToNext: rankInfo.pointsToNext,
          phase: rankInfo.phase,
          seasonMatches: 0,
          softDemoted: false
        })
      } catch (err) {
        console.error('Failed to fetch opponent rank:', err)
        setRankData(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOpponentRank()
  }, [opponentId])

  return { rankData, isLoading }
}

export default useRankV2
