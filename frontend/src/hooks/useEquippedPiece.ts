import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface PieceSkinData {
  id: string
  item_code: string
  preview_url?: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  name: string
  asset_data?: {
    black_stone?: string
    white_stone?: string
    stone?: string
    black_color?: string
    white_color?: string
  }
}

/**
 * Hook to load and manage the user's equipped piece skin
 * Uses user_items.is_equipped flag
 */
export function useEquippedPiece(userId?: string) {
  const [pieceSkin, setPieceSkin] = useState<PieceSkinData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadPieceSkin = useCallback(async () => {
    if (!userId) {
      setPieceSkin(null)
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

      // Find equipped piece_skin
      const equippedPiece = data?.find((row: any) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items
        const cat = (item?.category || '').toLowerCase()
        return cat.includes('piece') || cat === 'piece_skin'
      })

      if (equippedPiece) {
        const item = Array.isArray(equippedPiece.items) ? equippedPiece.items[0] : equippedPiece.items
        if (item) {
          const sharedStone = item.asset_data?.stone || item.asset_data?.black_stone || item.asset_data?.white_stone || item.preview_url
          setPieceSkin({
            id: item.id,
            item_code: item.item_code,
            preview_url: item.preview_url,
            rarity: item.rarity as PieceSkinData['rarity'],
            name: item.name,
            asset_data: {
              ...item.asset_data,
              stone: sharedStone,
              black_stone: item.asset_data?.black_stone || sharedStone,
              white_stone: item.asset_data?.white_stone || sharedStone
            }
          })
        } else {
          setPieceSkin(null)
        }
      } else {
        setPieceSkin(null)
      }
    } catch (err: any) {
      console.warn('[useEquippedPiece] Failed to load:', err?.message)
      setError(err?.message || 'Failed to load piece skin')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadPieceSkin()

    if (!userId) return

    const channel = supabase
      .channel(`piece:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_items',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadPieceSkin()
      })
      .subscribe()

    const handleProfileUpdate = (e: any) => {
      if (e.detail?.field === 'piece_skin') {
        loadPieceSkin()
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)

    return () => {
      channel.unsubscribe()
      window.removeEventListener('profileUpdated', handleProfileUpdate)
    }
  }, [userId, loadPieceSkin])

  const equipPieceSkin = async (skinId: string | null) => {
    if (!userId) return { ok: false, message: 'Not logged in' }

    try {
      // Get all piece_skin items
      const { data: pieceItems } = await supabase
        .from('items')
        .select('id')
        .or('category.ilike.%piece%,category.eq.piece_skin')

      const pieceItemIds = (pieceItems || []).map((i: any) => i.id)

      // Unequip all piece skins
      if (pieceItemIds.length > 0) {
        await supabase
          .from('user_items')
          .update({ is_equipped: false })
          .eq('user_id', userId)
          .in('item_id', pieceItemIds)
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

      await loadPieceSkin()

      window.dispatchEvent(new CustomEvent('profileUpdated', {
        detail: { field: 'piece_skin', equipped_piece_skin: skinId }
      }))

      return { ok: true }
    } catch (err: any) {
      return { ok: false, message: err?.message || 'Failed to equip piece skin' }
    }
  }

  return { pieceSkin, loading, error, equipPieceSkin, reload: loadPieceSkin }
}

export default useEquippedPiece
