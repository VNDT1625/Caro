import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { PieceSkinConfig, BoardSkinConfig } from '../components/board/GomokuBoard'

export interface EquippedSkins {
  pieceSkin: PieceSkinConfig | null
  boardSkin: BoardSkinConfig | null
}

/**
 * Check if URL is from a trusted source (Supabase storage or local)
 * External URLs may be blocked by CORS
 */
function isValidSkinUrl(url: string | undefined): boolean {
  if (!url) return false
  // Allow Supabase storage URLs
  if (url.includes('supabase.co/storage')) return true
  // Allow local URLs
  if (url.startsWith('/') || url.startsWith('./')) return true
  // Allow data URLs
  if (url.startsWith('data:')) return true
  // Block external URLs that may have CORS issues
  console.warn('[useEquippedSkins] External URL may be blocked by CORS:', url)
  return false
}

/**
 * Hook to load all equipped skins for current user
 * Combines piece_skin and board_skin into one hook for convenience
 */
export function useEquippedSkins() {
  const [skins, setSkins] = useState<EquippedSkins>({ pieceSkin: null, boardSkin: null })
  const [loading, setLoading] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  const loadSkins = useCallback(async (uid: string) => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_items')
        .select(`
          item_id,
          is_equipped,
          items:item_id (
            id,
            item_code,
            category,
            asset_data,
            preview_url
          )
        `)
        .eq('user_id', uid)
        .eq('is_equipped', true)

      if (error) throw error

      let pieceSkin: PieceSkinConfig | null = null
      let boardSkin: BoardSkinConfig | null = null

      for (const row of data || []) {
        const item = Array.isArray(row.items) ? row.items[0] : row.items
        if (!item) continue
        
        const cat = (item.category || '').toLowerCase()
        const assetData = item.asset_data || {}

        if (cat.includes('piece') || cat.includes('skin_piece') || cat === 'piece_skin') {
          // Check if this is a "classic" skin (no image URLs, just colors or null asset_data)
          const hasImageUrl = assetData.stone || assetData.black_stone || assetData.white_stone || item.preview_url
          
          if (!hasImageUrl) {
            // Classic skin - only colors, no images (or null asset_data)
            // This will use default gradient rendering with custom colors
            // Default to standard black/white if no colors specified
            pieceSkin = {
              black_stone: undefined,
              white_stone: undefined,
              stone: undefined,
              black_color: assetData.black_color || '#1a1a1a',
              white_color: assetData.white_color || '#f5f5f5'
            }
          } else {
            // Image-based skin - validate URLs
            const previewUrl = item.preview_url || ''
            const rawSharedStone = assetData.stone || assetData.black_stone || assetData.white_stone || previewUrl
            const rawBlackStone = assetData.black_stone || rawSharedStone
            const rawWhiteStone = assetData.white_stone || rawSharedStone
            
            // Only use URLs that are from trusted sources (Supabase storage)
            // External URLs will be blocked by CORS
            const sharedStone = isValidSkinUrl(rawSharedStone) ? rawSharedStone : undefined
            const blackStone = isValidSkinUrl(rawBlackStone) ? rawBlackStone : undefined
            const whiteStone = isValidSkinUrl(rawWhiteStone) ? rawWhiteStone : undefined
            
            pieceSkin = {
              black_stone: blackStone,
              white_stone: whiteStone,
              stone: sharedStone,
              black_color: assetData.black_color,
              white_color: assetData.white_color
            }
          }
        } else if (cat.includes('board') || cat === 'board_skin') {
          boardSkin = {
            background: assetData.background,
            grid_color: assetData.grid_color,
            star_color: assetData.star_color,
            border_color: assetData.border_color
          }
        }
      }

      setSkins({ pieceSkin, boardSkin })
    } catch (err) {
      console.warn('[useEquippedSkins] Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser()
      const uid = data?.user?.id
      if (uid) {
        setUserId(uid)
        loadSkins(uid)
      }
    }
    loadUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      const uid = session?.user?.id
      if (uid) {
        setUserId(uid)
        loadSkins(uid)
      } else {
        setUserId(null)
        setSkins({ pieceSkin: null, boardSkin: null })
      }
    })

    return () => subscription.unsubscribe()
  }, [loadSkins])

  // Listen for profile updates
  useEffect(() => {
    const handleProfileUpdate = (e: any) => {
      if (e.detail?.field === 'piece_skin' || e.detail?.field === 'board_skin') {
        if (userId) loadSkins(userId)
      }
    }
    window.addEventListener('profileUpdated', handleProfileUpdate)
    return () => window.removeEventListener('profileUpdated', handleProfileUpdate)
  }, [userId, loadSkins])

  // Listen for realtime changes
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`skins:${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_items',
        filter: `user_id=eq.${userId}`
      }, () => {
        loadSkins(userId)
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [userId, loadSkins])

  return { ...skins, loading, reload: () => userId && loadSkins(userId) }
}

export default useEquippedSkins
