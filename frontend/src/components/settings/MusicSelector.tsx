import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useLanguage } from '../../contexts/LanguageContext'
import { AudioManager } from '../../lib/AudioManager'

const normalize = (val?: string | null) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const MUSIC_ALIASES = ['music', 'âm nhạc', 'am nhac']
const isMusicCategory = (cat?: string | null) => {
  if (!cat) return false
  const normalized = normalize(cat)
  return MUSIC_ALIASES.some(alias => normalize(alias) === normalized)
}
const isValidMediaUrl = (url?: string | null) => {
  if (!url) return false
  const trimmed = url.trim()
  if (!/^https?:\/\//i.test(trimmed)) return false
  if (trimmed.includes('WebKitFormBoundary')) return false
  return true
}

interface MusicItem {
  id: string
  item_code: string
  name: string
  name_en?: string
  name_zh?: string
  name_ja?: string
  preview_url: string
  is_equipped: boolean
}

export default function MusicSelector() {
  const { t, language } = useLanguage()
  const [ownedMusic, setOwnedMusic] = useState<MusicItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)

  // Helper to get localized name based on current language
  const getLocalizedName = (music: MusicItem): string => {
    switch (language) {
      case 'en': return music.name_en || music.name || 'Unknown'
      case 'zh': return music.name_zh || music.name_en || music.name || 'Unknown'
      case 'ja': return music.name_ja || music.name_en || music.name || 'Unknown'
      default: return music.name || 'Unknown' // Vietnamese default
    }
  }

  // Load owned music on mount
  useEffect(() => {
    loadOwnedMusic()
    return () => {
      // Cleanup preview audio
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [])

  async function loadOwnedMusic() {
    setLoading(true)
    try {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch owned music items with all language fields
      const { data, error } = await supabase
        .from('user_items')
        .select(`
          item_id,
          is_equipped,
          items (
            id,
            item_code,
            name,
            name_en,
            name_zh,
            name_ja,
            preview_url,
            category
          )
        `)
        .eq('user_id', user.id)

      if (error) throw error

      // Filter music items - category id is 'Music' in database
      const musicItems = (data || [])
        .filter((ui: any) => {
          const cat = ui.items?.category
          return isMusicCategory(cat)
        })
        .map((ui: any) => ({
          id: ui.items.id,
          item_code: ui.items.item_code || ui.items.id,
          name: ui.items.name || 'Unknown',
          name_en: ui.items.name_en,
          name_zh: ui.items.name_zh,
          name_ja: ui.items.name_ja,
          preview_url: ui.items.preview_url || '',
          is_equipped: ui.is_equipped || false
        }))

      setOwnedMusic(musicItems)

      // Find currently equipped music
      const equipped = musicItems.find((m: MusicItem) => m.is_equipped)
      if (equipped) {
        setSelectedId(equipped.id)
      }
    } catch (err) {
      console.error('Failed to load owned music:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSelect(musicId: string | null) {
    try {
      const { data: userData } = await supabase.auth.getUser()
      const user = userData?.user
      if (!user) return

      // Stop preview if playing
      stopPreview()

      if (musicId === null) {
        // Reset to default - unequip all music
        const musicItemIds = ownedMusic.map(m => m.id)
        if (musicItemIds.length > 0) {
          await supabase
            .from('user_items')
            .update({ is_equipped: false })
            .eq('user_id', user.id)
            .in('item_id', musicItemIds)
        }
        
        setSelectedId(null)
        setOwnedMusic(prev => prev.map(m => ({ ...m, is_equipped: false })))
        AudioManager.setBackgroundMusic(null, null)
        return
      }

      // Unequip all music first
      const musicItemIds = ownedMusic.map(m => m.id)
      if (musicItemIds.length > 0) {
        await supabase
          .from('user_items')
          .update({ is_equipped: false })
          .eq('user_id', user.id)
          .in('item_id', musicItemIds)
      }

      // Equip selected music
      await supabase
        .from('user_items')
        .update({ is_equipped: true })
        .eq('user_id', user.id)
        .eq('item_id', musicId)

      // Update local state
      setSelectedId(musicId)
      setOwnedMusic(prev => prev.map(m => ({
        ...m,
        is_equipped: m.id === musicId
      })))

      // Update AudioManager - setBackgroundMusic sẽ tự động play với crossfade
      const selected = ownedMusic.find(m => m.id === musicId)
      if (selected?.preview_url) {
        AudioManager.setBackgroundMusic(selected.preview_url, musicId)
      }
    } catch (err) {
      console.error('Failed to select music:', err)
    }
  }

  async function handlePreview(music: MusicItem) {
    // Toggle preview
    if (previewingId === music.id) {
      stopPreview()
      return
    }

    // Stop current preview
    stopPreview()

    // Start new preview
    if (isValidMediaUrl(music.preview_url)) {
      const url = music.preview_url
      const audio = new Audio()
      audio.crossOrigin = ''
      audio.src = url
      audio.volume = 0.5
      audio.play().catch(err => console.warn('Preview failed:', err))
      audio.onended = () => {
        setPreviewingId(null)
        previewAudioRef.current = null
      }
      previewAudioRef.current = audio
      setPreviewingId(music.id)
    } else {
      console.warn('Preview skipped invalid media URL', music.preview_url)
    }
  }

  function stopPreview() {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }
    setPreviewingId(null)
  }

  if (loading) {
    return (
      <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
        {t('common.loading')}...
      </div>
    )
  }

  return (
    <div className="music-selector">
      <label style={{ 
        display: 'block', 
        marginBottom: 8, 
        fontSize: 14, 
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 500
      }}>
        {t('settings.backgroundMusic')}
      </label>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Default option */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            background: selectedId === null 
              ? 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.15))'
              : 'rgba(255,255,255,0.05)',
            border: `1px solid ${selectedId === null ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onClick={() => handleSelect(null)}
        >
          <span style={{ color: selectedId === null ? '#22D3EE' : 'rgba(255,255,255,0.8)' }}>
            🎵 {t('settings.defaultMusic')}
          </span>
          {selectedId === null && (
            <span style={{ color: '#22D3EE', fontSize: 12 }}>✓</span>
          )}
        </div>

        {/* Owned music */}
        {ownedMusic.map(music => (
          <div 
            key={music.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: selectedId === music.id 
                ? 'linear-gradient(135deg, rgba(34,211,238,0.15), rgba(59,130,246,0.15))'
                : 'rgba(255,255,255,0.05)',
              border: `1px solid ${selectedId === music.id ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => handleSelect(music.id)}
          >
            <span style={{ 
              color: selectedId === music.id ? '#22D3EE' : 'rgba(255,255,255,0.8)',
              flex: 1
            }}>
              🎵 {getLocalizedName(music)}
            </span>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Preview button */}
              <button
                style={{
                  padding: '4px 10px',
                  background: previewingId === music.id 
                    ? 'rgba(239,68,68,0.2)' 
                    : 'rgba(34,211,238,0.2)',
                  border: `1px solid ${previewingId === music.id ? 'rgba(239,68,68,0.4)' : 'rgba(34,211,238,0.3)'}`,
                  borderRadius: 4,
                  color: previewingId === music.id ? '#EF4444' : '#22D3EE',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  handlePreview(music)
                }}
              >
                {previewingId === music.id ? '⏹' : '▶'}
              </button>
              
              {selectedId === music.id && (
                <span style={{ color: '#22D3EE', fontSize: 12 }}>✓</span>
              )}
            </div>
          </div>
        ))}

        {ownedMusic.length === 0 && (
          <div style={{ 
            padding: 16, 
            textAlign: 'center', 
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13
          }}>
            {t('settings.noMusicOwned')}
            <br />
            <a 
              href="#shop" 
              style={{ color: '#22D3EE', textDecoration: 'none' }}
            >
              {t('settings.visitShop')}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
