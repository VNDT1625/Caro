import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { AudioManager } from '../lib/AudioManager'

const normalize = (val?: string | null) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const MUSIC_ALIASES = ['music', 'âm nhạc', 'am nhac']
const isMusicCategory = (cat?: string | null) => {
  if (!cat) return false
  const normalized = normalize(cat)
  return MUSIC_ALIASES.some(alias => normalize(alias) === normalized)
}

/**
 * Hook to load and apply equipped music on app start
 * Should be called once in App.tsx or main layout
 * Waits for AudioManager to be initialized before loading
 */
export function useEquippedMusic() {
  useEffect(() => {
    // Wait a bit for AudioManager to initialize (it's initialized in useEffect)
    // and for user interaction to enable autoplay
    const timer = setTimeout(() => {
      loadEquippedMusic()
    }, 500)
    
    return () => clearTimeout(timer)
  }, [])
}

async function loadEquippedMusic() {
  try {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return

    // Find equipped music item
    const { data, error } = await supabase
      .from('user_items')
      .select(`
        item_id,
        items (
          id,
          preview_url,
          category
        )
      `)
      .eq('user_id', user.id)
      .eq('is_equipped', true)

    if (error) {
      console.warn('[useEquippedMusic] Failed to load:', error)
      return
    }

    console.log('[useEquippedMusic] All equipped items:', data)

    // Find music item - category id is 'âm nhạc' in database
    const musicItem = (data || []).find((ui: any) => {
      const items = ui.items
      // Skip if no items data (item may have been deleted)
      if (!items) {
        console.log('[useEquippedMusic] Skipping user_item with no items data:', ui.item_id)
        return false
      }
      if (Array.isArray(items)) {
        const found = items.some((i: any) => {
          const cat = i.category
          const isMusic = isMusicCategory(cat)
          console.log('[useEquippedMusic] Checking item (array):', { id: i.id, category: cat, isMusic, preview_url: i.preview_url })
          return isMusic
        })
        return found
      }
      const cat = items?.category
      const isMusic = isMusicCategory(cat)
      console.log('[useEquippedMusic] Checking item:', { id: items?.id, category: cat, isMusic, preview_url: items?.preview_url })
      return isMusic
    })
    
    if (musicItem) {
      const items = musicItem.items
      // Handle both array and object response from Supabase
      const itemData = Array.isArray(items) ? items[0] : items
      console.log('[useEquippedMusic] Found equipped music item:', { 
        id: itemData?.id, 
        preview_url: itemData?.preview_url,
        category: itemData?.category 
      })
      if (itemData?.preview_url) {
        // Check if music is enabled in settings before playing
        const settings = AudioManager.getSettings()
        console.log('[useEquippedMusic] Current audio settings:', settings)
        
        if (settings.bgMusic && settings.bgMusicVolume > 0) {
          console.log('[useEquippedMusic] Setting background music:', itemData.preview_url)
          AudioManager.setBackgroundMusic(itemData.preview_url, itemData.id)
          // setBackgroundMusic already calls playBackgroundMusic if enabled, no need to call again
        } else {
          // Just store the URL without playing - it will be used when user enables music
          console.log('[useEquippedMusic] Music disabled, storing URL only:', itemData.preview_url)
          AudioManager.setBackgroundMusic(itemData.preview_url, itemData.id)
        }
      } else {
        console.warn('[useEquippedMusic] Music item has no preview_url:', itemData)
      }
    } else {
      console.log('[useEquippedMusic] No equipped music found, using default')
    }
  } catch (err) {
    console.warn('[useEquippedMusic] Error:', err)
  }
}

export default useEquippedMusic
