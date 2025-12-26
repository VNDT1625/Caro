import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface BoardSkinData {
  id: string
  item_code: string
  preview_url?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  name: string
  asset_data?: {
    background?: string
    grid_color?: string
    star_color?: string
    border_color?: string
  }
}

/**
 * Hook to load and manage the user's equipped board skin
 * Uses user_items.is_equipped flag
 */
export function useEquippedBoard(userId?: string) {
  const [boardSkin, setBoardSkin] = useState<BoardSkinData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBoardSkin = useCallback(async () => {
    if (!userId) {
      setBoardSkin(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
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
            category,
            asset_data
          )
        `)
        .eq('user_id', userId)
        .eq('is_equipped', true)

      if (queryError) throw queryError

      // Find equipped board_skin
      const equippedBoard = data?.find((row: any) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items
        const cat = (item?.category || '').toLowerCase()
        return cat.includes('board') || cat === 'board_skin'
      })

      if (equippedBoard) {
        const item = Array.isArray(equippedBoard.items) ? equippedBoard.items[0] : equippedBoard.items
        if (item) {
          setBoardSkin({
            id: item.id,
            item_code: item.item_code,
            preview_url: item.preview_url,
            rarity: item.rarity as BoardSkinData['rarity'],
            name: item.name,
            asset_data: item.asset_data
          })
        } else {
          setBoardSkin(null)
        }
      } else {
        setBoardSkin(null)
      }
    } catch (err: any) {
      console.warn('[useEquippedBoard] Failed to load:', err?.message)
      setError(err?.message || 'Failed to load board skin')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadBoardSkin()

    if (!userId) return

    const channel = supabase
      .channel(`board:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_items',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadBoardSkin()
      })
      .subscribe()

    const handleProfileUpdate = (e: any) => {
      if (e.detail?.field === 'board_skin') {
        loadBoardSkin()
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      channel.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [userId, loadBoardSkin])

  const equipBoardSkin = async (skinId: string | null) => {
    if (!userId) return { ok: false, message: 'Not logged in' }

    try {
      // Get all board_skin items
      const { data: boardItems } = await supabase
        .from('items')
        .select('id')
        .or('category.ilike.%board%,category.eq.board_skin')

      const boardItemIds = (boardItems || []).map((i: any) => i.id)

      // Unequip all board skins
      if (boardItemIds.length > 0) {
        await supabase
          .from('user_items')
          .update({ is_equipped: false })
          .eq('user_id', userId)
          .in('item_id', boardItemIds)
      }

      // Equip new skin
      if (skinId) {
        const { error: equipError } = await supabase
          .from('user_items')
          .update({ is_equipped: true })
          .eq('user_id', userId)
          .eq('item_id', skinId)

        if (equipError) throw equipError
      }

      await loadBoardSkin()

      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: { field: 'board_skin', equipped_board_skin: skinId }
      }))

      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to equip board skin' }
    }
  }

  return { boardSkin, loading, error, equipBoardSkin, reload: loadBoardSkin }
}

export default useEquippedBoard
