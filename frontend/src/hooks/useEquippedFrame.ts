import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { AvatarFrameData } from '../components/avatar'

/**
 * Hook to load and manage the user's equipped avatar frame
 * Uses user_items.is_equipped flag (same pattern as board_skin, piece_skin)
 */
export function useEquippedFrame(userId?: string) {
  const [frame, setFrame] = useState<AvatarFrameData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadFrame = useCallback(async () => {
    if (!userId) {
      setFrame(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Get equipped frame from user_items (is_equipped = true AND category = avatar_frame)
      const { data, error: queryError } = await supabase
        .from('user_items')
        .select(`
          item_id,
          is_equipped,
          items:item_id (
            id,
            item_code,
            preview_url,
            rarity,
            name,
            category
          )
        `)
        .eq('user_id', userId)
        .eq('is_equipped', true)

      if (queryError) throw queryError

      // Find the equipped avatar_frame
      // Note: Supabase returns items as array for FK relation, take first element
      const equippedFrame = data?.find((row: any) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items
        return item?.category === 'avatar_frame'
      })

      if (equippedFrame) {
        const item = Array.isArray(equippedFrame.items) ? equippedFrame.items[0] : equippedFrame.items
        if (item) {
          setFrame({
            id: item.id,
            item_code: item.item_code,
            preview_url: item.preview_url,
            rarity: item.rarity as AvatarFrameData['rarity'],
            name: item.name
          })
        } else {
          setFrame(null)
        }
      } else {
        setFrame(null)
      }
    } catch (err: any) {
      console.warn('[useEquippedFrame] Failed to load frame:', err?.message)
      setError(err?.message || 'Failed to load frame')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadFrame()

    // Listen for user_items updates
    if (!userId) return

    const channel = supabase
      .channel(`frame:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_items',
        filter: `user_id=eq.${userId}`
      }, () => {
        // Reload frame when user_items changes
        loadFrame()
      })
      .subscribe()

    // Also listen for profileUpdated event
    const handleProfileUpdate = (e: any) => {
      if (e.detail?.field === 'avatar_frame') {
        loadFrame()
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      channel.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [userId, loadFrame])

  // Function to equip a frame
  const equipFrame = async (frameId: string | null) => {
    if (!userId) return { ok: false, message: 'Not logged in' }

    try {
      // First, unequip all current avatar_frames for this user
      const { data: currentFrames } = await supabase
        .from('user_items')
        .select('id, item_id, items:item_id(category)')
        .eq('user_id', userId)
        .eq('is_equipped', true)

      // Unequip avatar_frame items
      const frameItems = currentFrames?.filter((r: any) => r.items?.category === 'avatar_frame') || []
      for (const item of frameItems) {
        await supabase
          .from('user_items')
          .update({ is_equipped: false })
          .eq('id', item.id)
      }

      // If frameId provided, equip the new frame
      if (frameId) {
        const { error: equipError } = await supabase
          .from('user_items')
          .update({ is_equipped: true })
          .eq('user_id', userId)
          .eq('item_id', frameId)

        if (equipError) throw equipError
      }

      // Reload frame
      await loadFrame()

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: { field: 'avatar_frame', equipped_avatar_frame: frameId }
      }))

      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to equip frame' }
    }
  }

  return { frame, loading, error, equipFrame, reload: loadFrame }
}

/**
 * Get frame data by item ID (one-time fetch)
 */
export async function getFrameById(frameId: string): Promise<AvatarFrameData | null> {
  try {
    const { data, error } = await supabase
      .from('items')
      .select('id, item_code, preview_url, rarity, name')
      .eq('id', frameId)
      .maybeSingle()

    if (error || !data) return null

    return {
      id: data.id,
      item_code: data.item_code,
      preview_url: data.preview_url,
      rarity: data.rarity as AvatarFrameData['rarity'],
      name: data.name
    }
  } catch {
    return null
  }
}

/**
 * Get all owned frames for a user
 */
export async function getOwnedFrames(userId: string): Promise<(AvatarFrameData & { isEquipped?: boolean })[]> {
  try {
    const { data, error } = await supabase
      .from('user_items')
      .select(`
        item_id,
        is_equipped,
        items:item_id (
          id,
          item_code,
          preview_url,
          rarity,
          name,
          name_en,
          category
        )
      `)
      .eq('user_id', userId)

    if (error || !data) return []

    return data
      .map((row: any) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items
        return { ...row, item }
      })
      .filter((row: any) => row.item?.category === 'avatar_frame')
      .map((row: any) => ({
        id: row.item.id,
        item_code: row.item.item_code,
        preview_url: row.item.preview_url,
        rarity: row.item.rarity as AvatarFrameData['rarity'],
        name: row.item.name,
        isEquipped: row.is_equipped
      }))
  } catch {
    return []
  }
}
