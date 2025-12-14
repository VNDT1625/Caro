import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { AudioManager } from '../lib/AudioManager'
import { MobileBreadcrumb } from '../components/layout'

type Item = { 
  id: string
  item_code?: string
  title: string
  subtitle?: string
  media_url?: string
  rarity?: string
  type?: string
  is_equipped?: boolean
  acquired_at?: string
  name_vi?: string
  name_en?: string
}

type Category = {
  id: string
  name_vi: string
  name_en?: string
  icon?: string
  color?: string
  sort_order: number
}

// Helpers to localize category names similar to Shop
function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getCategoryName(categoryId: string, t: (key: string) => string): string {
  const normalized = categoryId === 'title' ? 'titles' : categoryId
  const key = `shop.type.${normalized}`
  const translated = t(key)
  return capitalize(translated || categoryId)
}

const normalize = (val?: string | null) => (val || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const MUSIC_ALIASES = ['music', 'âm nhạc', 'am nhac']
const isMusicCategory = (cat?: string | null) => {
  if (!cat) return false
  const normalized = normalize(cat)
  return MUSIC_ALIASES.some(alias => normalize(alias) === normalized)
}

const resolveItemText = (t: (key: string)=>string, code: string, fallback: string, kind: 'title' | 'desc') => {
  const key = `shop.item.${code}.${kind}`
  const translated = t(key)
  const normalized = translated?.toLowerCase()
  if (translated && translated !== key && normalized !== kind) return translated
  return fallback
}
const isValidMediaUrl = (url?: string | null) => {
  if (!url) return false
  const trimmed = url.trim()
  // Allow both http(s) URLs and local paths starting with /
  if (!/^(https?:\/\/|\/)/i.test(trimmed)) return false
  if (trimmed.includes('WebKitFormBoundary')) return false
  return true
}

// Get icon for category placeholder
const getCategoryIcon = (category?: string | null): string => {
  const cat = (category || '').toLowerCase()
  if (cat.includes('piece') || cat.includes('skin_piece') || cat.includes('piece_skin')) return '♟️'
  if (cat.includes('board') || cat.includes('skin_board') || cat.includes('board_skin')) return '🎯'
  if (cat.includes('music') || cat.includes('âm nhạc') || cat.includes('am nhac')) return '🎵'
  if (cat.includes('avatar') || cat.includes('frame')) return '🖼️'
  if (cat.includes('title') || cat.includes('danh hiệu')) return '👑'
  if (cat.includes('emote')) return '😀'
  return '📦'
}

function Card({ 
  item, 
  onUse, 
  using,
  onPreview,
  isPreviewing
}: { 
  item: Item
  onUse: (it: Item) => Promise<{ ok: boolean; message?: string }>
  using?: boolean
  onPreview?: (it: Item) => void
  isPreviewing?: boolean
}) {
  const [hover, setHover] = React.useState(false)
  // Check for music category - id is 'Music' in database
  const isMusic = isMusicCategory(item.type)
  const [pos, setPos] = React.useState<{ left: number; top: number; width: number; height: number }>({ 
    left: 0, 
    top: 0, 
    width: 340, 
    height: 210 
  })
  const previewW = 340
  const previewH = 210
  const isVideo = item.media_url && item.media_url.endsWith('.mp4')

  const { t } = useLanguage()
  
  function rarityLabel(r?: string) {
    if (!r) return ''
    const key = r.toString().toLowerCase()
    switch (key) {
      case 'common': return t('inventory.rarityCommon')
      case 'rare': return t('inventory.rarityRare')
      case 'epic': return t('inventory.rarityEpic')
      case 'legendary': return t('inventory.rarityLegendary')
      default: return r
    }
  }

  const latestMouse = React.useRef<{ x: number; y: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number>(0)
  const minInterval = 40

  React.useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      latestMouse.current = null
    }
  }, [])

  function processMouse() {
    const coords = latestMouse.current
    if (!coords) {
      rafRef.current = null
      return
    }
    const now = performance.now()
    if (now - lastTimeRef.current < minInterval) {
      rafRef.current = requestAnimationFrame(processMouse)
      return
    }
    lastTimeRef.current = now

    const margin = 12
    const x = coords.x
    const y = coords.y
    const winW = window.innerWidth

    const rightSpace = winW - x - margin
    const leftSpace = x - margin

    const avail = rightSpace >= previewW ? rightSpace : leftSpace
    const minW = 320
    const maxW = 360
    let width = Math.max(minW, Math.min(previewW, avail))
    if (width > maxW) width = maxW
    const scale = width / previewW
    const height = Math.max(100, Math.round(previewH * scale))

    const left = rightSpace >= previewW ? x + margin : x - width - margin

    let top = y - height / 2
    const minTop = 8
    const maxTop = window.innerHeight - height - 8
    if (top < minTop) top = minTop
    if (top > maxTop) top = maxTop

    setPos({ left, top, width, height })

    latestMouse.current = null
    rafRef.current = null
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (window.innerWidth <= 600) return

    latestMouse.current = { x: e.clientX, y: e.clientY }
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(processMouse)
    }
  }

  return (
    <div 
      className="shop-card" 
      onMouseEnter={() => setHover(true)} 
      onMouseLeave={() => setHover(false)} 
      onMouseMove={handleMouseMove}
    >
      <div className="shop-card-media">
        {item.rarity && (
          <div className={`rarity-badge ${item.rarity ? `rarity-${item.rarity}` : ''}`}>
            {rarityLabel(item.rarity)}
          </div>
        )}
        {item.media_url && isValidMediaUrl(item.media_url) ? (
          isVideo ? (
            <video 
              src={item.media_url} 
              autoPlay 
              muted 
              loop 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} 
            />
          ) : (
            <img 
              src={item.media_url} 
              alt={item.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} 
              onError={(e) => {
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  const placeholder = document.createElement('div')
                  placeholder.className = 'item-placeholder'
                  placeholder.innerHTML = getCategoryIcon(item.type)
                  parent.appendChild(placeholder)
                }
              }}
            />
          )
        ) : (
          <div className="item-placeholder" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            fontSize: 36,
            color: 'rgba(255,255,255,0.3)'
          }}>
            <span>{getCategoryIcon(item.type)}</span>
            <span style={{ fontSize: 11, marginTop: 4 }}>{t('shop.preview')}</span>
          </div>
        )}
      </div>
      <div className="shop-card-body">
        <div className="shop-card-title">{
          (() => {
            const code = item.item_code || item.id
            const direct = typeof item.title === 'string' ? item.title : ''
            return resolveItemText(t, code, direct || code, 'title')
          })()
        }</div>
        <div className="shop-card-sub">{
          (() => {
            const code = item.item_code || item.id
            const desc = item.subtitle || ''
            return resolveItemText(t, code, desc, 'desc')
          })()
        }</div>
        {item.acquired_at && (
          <div className="acquired-date">
            {t('inventory.acquired')}: {new Date(item.acquired_at).toLocaleDateString('vi-VN')}
          </div>
        )}
        <div className="shop-card-footer">
          <div className="shop-card-price">
            {/* Preview button for music items */}
            {isMusic && onPreview && (
              <button
                className="preview-btn"
                style={{
                  padding: '6px 12px',
                  background: isPreviewing 
                    ? 'linear-gradient(135deg, rgba(239,68,68,0.3), rgba(239,68,68,0.2))'
                    : 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(59,130,246,0.2))',
                  border: `1px solid ${isPreviewing ? 'rgba(239,68,68,0.5)' : 'rgba(34,211,238,0.4)'}`,
                  borderRadius: 6,
                  color: isPreviewing ? '#EF4444' : '#22D3EE',
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(item)
                }}
              >
                {isPreviewing ? '⏹' : '▶'} {isPreviewing ? t('inventory.stopPreview') : t('inventory.preview')}
              </button>
            )}
          </div>
          <button
            className="shop-buy inventory-use"
            style={{ 
              opacity: using ? 0.6 : 1,
              cursor: using ? 'not-allowed' : 'pointer'
            }}
            disabled={using}
            onClick={async (e) => {
              e.stopPropagation()
              if (using) return
              await onUse(item)
            }}
          >
            {item.is_equipped ? `✓ ${t('inventory.using')}` : t('inventory.use')}
          </button>
        </div>
      </div>
      <div
        className={`shop-card-preview ${hover ? 'visible' : ''}`}
        style={{
          position: 'fixed',
          left: Math.round(pos.left),
          top: Math.round(pos.top),
          width: Math.round(pos.width),
          height: Math.round(pos.height),
          transition: 'opacity .12s ease',
          borderRadius: 24,
          padding: 24,
          boxSizing: 'border-box',
          overflow: 'hidden',
          pointerEvents: 'none'
        }}
      >
        {item.media_url ? (
          isVideo ? (
            <video 
              src={item.media_url} 
              autoPlay 
              muted 
              loop 
              playsInline 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          ) : (
            <img 
              src={item.media_url} 
              alt={item.title} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          )
        ) : (
          <div className="shop-card-preview-fallback">{t('shop.noPreview')}</div>
        )}
      </div>
    </div>
  )
}

export default function Inventory() {
  const { t, language } = useLanguage()
  
  // Helper to get localized item text - wrapped in useCallback to prevent infinite loop
  const getLocalizedItemText = React.useCallback((viText: string, enText?: string | null) => {
    if (language === 'vi') return viText
    if (language === 'en') return enText || viText
    if (language === 'zh') return enText || viText
    if (language === 'ja') return enText || viText
    return viText // Fallback to Vietnamese
  }, [language])
  
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [rarity, setRarity] = useState('all')
  const [equipped, setEquipped] = useState('all')
  
  const [items, setItems] = useState<Item[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [user, setUser] = useState<any | null>(null)
  const [using, setUsing] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Music preview state
  const [previewingId, setPreviewingId] = useState<string | null>(null)
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null)
  
  // Mobile filter popup state
  const [filterPopupOpen, setFilterPopupOpen] = useState(false)
  const [tempType, setTempType] = useState('all')
  const [tempRarity, setTempRarity] = useState('all')
  const [tempEquipped, setTempEquipped] = useState('all')
  
  // Count active filters
  const activeFilterCount = [
    type !== 'all' ? 1 : 0,
    rarity !== 'all' ? 1 : 0,
    equipped !== 'all' ? 1 : 0
  ].reduce((a, b) => a + b, 0)
  
  const openFilterPopup = () => {
    setTempType(type)
    setTempRarity(rarity)
    setTempEquipped(equipped)
    setFilterPopupOpen(true)
  }
  
  const applyFilters = () => {
    setType(tempType)
    setRarity(tempRarity)
    setEquipped(tempEquipped)
    setFilterPopupOpen(false)
  }
  
  const resetFilters = () => {
    setTempType('all')
    setTempRarity('all')
    setTempEquipped('all')
  }

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState<string | null>(null)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const modalResolveRef = React.useRef<((val: boolean) => void) | null>(null)

  // Cleanup preview audio on unmount
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
    }
  }, [])

  // Handle music preview
  async function handlePreview(item: Item) {
    // If same item, toggle off
    if (previewingId === item.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause()
        previewAudioRef.current = null
      }
      setPreviewingId(null)
      return
    }

    // Stop current preview
    if (previewAudioRef.current) {
      previewAudioRef.current.pause()
      previewAudioRef.current = null
    }

    // Start new preview
    if (isValidMediaUrl(item.media_url)) {
      const url = item.media_url!
      console.log('[Inventory] Starting preview for:', url)
      
      try {
        // For Supabase URLs, fetch as blob to bypass MIME type issues
        if (url.includes('supabase.co/storage')) {
          console.log('[Inventory] Fetching Supabase audio as blob...')
          const response = await fetch(url)
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const blob = await response.blob()
          console.log('[Inventory] Blob received:', { size: blob.size, type: blob.type })
          
          // Create blob with correct audio type
          const audioBlob = blob.type.startsWith('audio/') 
            ? blob 
            : new Blob([blob], { type: 'audio/mpeg' })
          const blobUrl = URL.createObjectURL(audioBlob)
          
          const audio = new Audio(blobUrl)
          audio.volume = 0.5
          audio.loop = true
          audio.onended = () => {
            URL.revokeObjectURL(blobUrl)
            setPreviewingId(null)
            previewAudioRef.current = null
          }
          audio.onerror = () => {
            URL.revokeObjectURL(blobUrl)
            console.warn('[Inventory] Preview audio error')
            setPreviewingId(null)
            previewAudioRef.current = null
          }
          await audio.play()
          previewAudioRef.current = audio
          setPreviewingId(item.id)
        } else {
          // For other URLs, use standard approach
          const audio = new Audio()
          audio.src = url
          audio.volume = 0.5
          audio.loop = true
          audio.play().catch(err => {
            console.warn('Preview play failed:', err)
          })
          audio.onended = () => {
            setPreviewingId(null)
            previewAudioRef.current = null
          }
          previewAudioRef.current = audio
          setPreviewingId(item.id)
        }
      } catch (err) {
        console.warn('[Inventory] Preview failed:', err)
        alert('Không thể phát preview. File có thể bị lỗi hoặc không tồn tại.')
      }
    } else {
      console.warn('Preview skipped invalid media URL', item.media_url)
    }
  }

  function openInfo(title: string, message: string) {
    return new Promise<void>((resolve) => {
      modalResolveRef.current = () => {
        resolve()
        return true
      }
      setModalTitle(title)
      setModalMessage(message)
      setModalOpen(true)
    })
  }

  function closeModal() {
    const r = modalResolveRef.current
    modalResolveRef.current = null
    setModalOpen(false)
    setModalTitle(null)
    setModalMessage(null)
    try { if (r) r(true) } catch (e) { /* ignore */ }
  }

  // Load categories
  useEffect(() => {
    let cancelled = false
    async function loadCategories() {
      try {
        const { data } = await supabase
          .from('categories')
          .select('id, name_vi, name_en, icon, color, sort_order')
          .eq('is_active', true)
          .order('sort_order')
        if (!cancelled && data) setCategories(data)
      } catch (err) {
        console.warn('Failed to load categories:', err)
      }
    }
    loadCategories()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const fetchItems = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: userData } = await supabase.auth.getUser()
        const u = userData?.user ?? null
        if (!u) {
          setItems([])
          setLoading(false)
          return
        }
        setUser(u)

        // Fetch owned items with item details
        let qb: any = supabase
          .from('user_items')
          .select(`
            id,
            item_id,
            is_equipped,
            acquired_at,
            items (
              id,
              item_code,
              name,
              description,
              category,
              rarity,
              preview_url,
              name_en,
              description_en
            )
          `)
          .eq('user_id', u.id)

        const { data, error } = await qb
        if (error) throw error

        if (!cancelled && Array.isArray(data)) {
          const mapped = data
            .filter((ui: any) => ui.items) // ensure item exists
            .map((ui: any) => {
              const i = ui.items
              return {
                id: ui.item_id,
                item_code: i.item_code || ui.item_id,
                title: getLocalizedItemText(i.name || 'Unknown Item', i.name_en),
                subtitle: getLocalizedItemText(i.description || '', i.description_en),
                media_url: i.preview_url || '',
                rarity: i.rarity || 'common',
                type: i.category || 'other',
                is_equipped: ui.is_equipped || false,
                acquired_at: ui.acquired_at,
                name_vi: i.name || '',
                name_en: i.name_en || ''
              }
            })

          // Fix duplicate equipped items of same type
          const categoryMap = new Map<string, string[]>()
          mapped.forEach((item: Item) => {
            if (item.is_equipped) {
              const cat = item.type || 'other'
              if (!categoryMap.has(cat)) {
                categoryMap.set(cat, [])
              }
              categoryMap.get(cat)!.push(item.id)
            }
          })

          // If multiple items of same category are equipped, unequip all except the first one
          for (const [category, itemIds] of categoryMap.entries()) {
            if (itemIds.length > 1) {
              console.log(`Found ${itemIds.length} equipped items in category ${category}, fixing...`)
              // Keep first, unequip others
              const toUnequip = itemIds.slice(1)
              await supabase
                .from('user_items')
                .update({ is_equipped: false })
                .eq('user_id', u.id)
                .in('item_id', toUnequip)

              // Update local state
              mapped.forEach((item: Item) => {
                if (toUnequip.includes(item.id)) {
                  item.is_equipped = false
                }
              })
            }
          }

          // Apply filters
          let filtered = mapped
          if (type !== 'all') {
            filtered = filtered.filter((it: Item) => {
              const cat = it.type?.toLowerCase() || ''
              if (type === 'skin') return cat.includes('piece') || (cat.includes('skin') && !cat.includes('board'))
              if (type === 'board') return cat.includes('board')
              return it.type === type
            })
          }
          if (rarity !== 'all') {
            filtered = filtered.filter((it: Item) => it.rarity === rarity)
          }
          if (equipped !== 'all') {
            filtered = filtered.filter((it: Item) => 
              equipped === 'equipped' ? it.is_equipped : !it.is_equipped
            )
          }
          if (query && query.trim()) {
            const q = query.trim().toLowerCase()
            filtered = filtered.filter((it: Item) => {
              // Search in displayed title (already localized)
              const titleMatch = it.title.toLowerCase().includes(q)
              // Search in subtitle
              const subtitleMatch = it.subtitle?.toLowerCase().includes(q)
              // Search in original Vietnamese name
              const nameViMatch = (it.name_vi || '').toLowerCase().includes(q)
              // Search in English name
              const nameEnMatch = (it.name_en || '').toLowerCase().includes(q)
              // Search in i18n translated name using item_code
              const code = it.item_code || it.id
              const i18nKey = `shop.item.${code}.title`
              const i18nName = t(i18nKey)
              const i18nMatch = i18nName !== i18nKey && i18nName.toLowerCase().includes(q)
              return titleMatch || subtitleMatch || nameViMatch || nameEnMatch || i18nMatch
            })
          }

          setItems(filtered)
        }
      } catch (err: any) {
        console.warn('Inventory fetch failed:', err)
        const friendly = err?.message ?? 'Không thể tải dữ liệu'
        setError(friendly)
        setItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchItems()
    return () => { cancelled = true }
  }, [query, type, rarity, equipped, language, getLocalizedItemText])

  async function handleUse(item: Item) {
    const id = item.id
    setUsing(prev => ({ ...prev, [id]: true }))
    try {
      if (!user) {
        await openInfo(t('inventory.modalError'), t('inventory.errorPleaseLogin'))
        return { ok: false }
      }

      if (item.is_equipped) {
        await openInfo(t('inventory.modalNotification'), t('inventory.errorAlreadyEquipped'))
        return { ok: false }
      }

      // Get all item IDs of the same type (category)
      const { data: sameTypeItems } = await supabase
        .from('items')
        .select('id')
        .eq('category', item.type || 'other')
      
      const sameTypeItemIds = (sameTypeItems || []).map((i: any) => i.id)

      // Unequip all items of same type first
      const { error: unequipErr } = await supabase
        .from('user_items')
        .update({ is_equipped: false })
        .eq('user_id', user.id)
        .in('item_id', sameTypeItemIds)

      if (unequipErr) throw unequipErr

      // Equip selected item
      const { error: equipErr } = await supabase
        .from('user_items')
        .update({ is_equipped: true })
        .eq('user_id', user.id)
        .eq('item_id', item.id)

      if (equipErr) throw equipErr

      // Refresh list
      setItems(prev => prev.map(it => ({
        ...it,
        is_equipped: it.id === item.id ? true : (it.type === item.type ? false : it.is_equipped)
      })))

      // If this is a music item, update AudioManager
      const isMusicItem = isMusicCategory(item.type)
      console.log('[Inventory] Equipping item:', { 
        id: item.id, 
        type: item.type, 
        isMusicItem, 
        media_url: item.media_url,
        media_url_length: item.media_url?.length || 0,
        isValidUrl: item.media_url ? /^https?:\/\//i.test(item.media_url) : false
      })
      if (isMusicItem && item.media_url) {
        // Stop any preview
        if (previewAudioRef.current) {
          previewAudioRef.current.pause()
          previewAudioRef.current = null
          setPreviewingId(null)
        }
        // Set as background music
        console.log('[Inventory] Setting background music:', item.media_url)
        AudioManager.setBackgroundMusic(item.media_url, item.id)
        AudioManager.playBackgroundMusic()
      } else if (isMusicItem && !item.media_url) {
        console.warn('[Inventory] Music item has no media_url:', item)
      }

      // Get localized item name for success message
      const code = item.item_code || item.id
      const i18nKey = `shop.item.${code}.title`
      const i18nName = t(i18nKey)
      const displayName = (i18nName && i18nName !== i18nKey) ? i18nName : item.title

      await openInfo(t('inventory.modalSuccess'), `${t('inventory.successEquipped')} "${displayName}"`)
      return { ok: true }
    } catch (err: any) {
      console.error('Use item failed', err)
      await openInfo(t('inventory.modalError'), err?.message || t('inventory.errorCannotUse'))
      return { ok: false }
    } finally {
      setUsing(prev => ({ ...prev, [id]: false }))
    }
  }

  // Group items by category dynamically
  const itemsByCategory: Record<string, Item[]> = {}
  items.forEach(item => {
    const cat = item.type || 'other'
    if (!itemsByCategory[cat]) itemsByCategory[cat] = []
    itemsByCategory[cat].push(item)
  })

  return (
    <div className="app-container">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span 
          style={{ fontSize: 13, color: 'var(--color-muted)', cursor: 'pointer' }}
          onClick={() => window.location.hash = '#home'}
        >
          {t('breadcrumb.home')}
        </span>
        <span style={{ color: 'var(--color-muted)' }}>›</span>
        <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
          {t('inventory.breadcrumbInventory')}
        </span>
      </div>
      
      {/* Mobile Category Pills */}
      <div className="inventory-category-pills-mobile">
        <button 
          className={`category-pill ${type === 'all' ? 'active' : ''}`}
          onClick={() => setType('all')}
        >
          {t('inventory.all')}
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            className={`category-pill ${type === cat.id ? 'active' : ''}`}
            onClick={() => setType(cat.id)}
          >
            {cat.icon} {getCategoryName(cat.id, t)}
          </button>
        ))}
      </div>
      
      <div className="shop-page" style={{ gap: 18 }}>
        <aside className="panel shop-sidebar">
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ 
              fontSize: 24, 
              fontWeight: 700, 
              color: '#22D3EE',
              textShadow: '0 0 20px rgba(34,211,238,0.5)',
              marginBottom: 8
            }}>
              {t('inventory.title')}
            </h2>
            <p style={{ 
              fontSize: 13, 
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.4
            }}>
              {t('inventory.subtitle')}
            </p>
          </div>

          <div style={{ marginTop: 12 }}>
            <input 
              className="sidebar-search" 
              placeholder={t('inventory.search')} 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </div>

          <div className="shop-filters" style={{ marginTop: 12 }}>
            <label className="filter-label">{t('inventory.filterType')}</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="all">{t('inventory.all')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {getCategoryName(cat.id, t)}
                </option>
              ))}
            </select>

            <label className="filter-label">{t('inventory.filterRarity')}</label>
            <select value={rarity} onChange={e => setRarity(e.target.value)}>
              <option value="all">{t('inventory.all')}</option>
              <option value="common">{t('inventory.rarityCommon')}</option>
              <option value="rare">{t('inventory.rarityRare')}</option>
              <option value="epic">{t('inventory.rarityEpic')}</option>
              <option value="legendary">{t('inventory.rarityLegendary')}</option>
            </select>

            <label className="filter-label">{t('inventory.filterStatus')}</label>
            <select value={equipped} onChange={e => setEquipped(e.target.value)}>
              <option value="all">{t('inventory.all')}</option>
              <option value="equipped">{t('inventory.statusEquipped')}</option>
              <option value="unequipped">{t('inventory.statusUnequipped')}</option>
            </select>
          </div>

          <div style={{ 
            marginTop: 16, 
            padding: 12, 
            background: 'rgba(34,211,238,0.05)',
            borderRadius: 8,
            border: '1px solid rgba(34,211,238,0.2)'
          }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
              {t('inventory.totalItems')}: <strong style={{ color: '#22D3EE' }}>{items.length}</strong>
            </div>
          </div>
        </aside>

        <main className="panel shop-main">
          <h2 className="section-title">{t('inventory.yourCollection')}</h2>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.6)' }}>
              {t('inventory.loading')}
            </div>
          )}

          {error && (
            <div style={{ 
              padding: 20, 
              background: 'rgba(239,68,68,0.1)', 
              borderRadius: 12,
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444',
              marginBottom: 20
            }}>
              {error}
            </div>
          )}

          {!loading && !user && (
            <div style={{ 
              textAlign: 'center', 
              padding: 60,
              color: 'rgba(255,255,255,0.6)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
              <div style={{ fontSize: 18, marginBottom: 8 }}>{t('inventory.pleaseLogin')}</div>
              <div style={{ fontSize: 14 }}>{t('inventory.toViewCollection')}</div>
            </div>
          )}

          {!loading && user && items.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: 60,
              color: 'rgba(255,255,255,0.6)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <div style={{ fontSize: 18, marginBottom: 8 }}>{t('inventory.noItems')}</div>
              <div style={{ fontSize: 14 }}>{t('inventory.visitShop')}</div>
              <button 
                onClick={() => window.location.hash = '#shop'}
                style={{
                  marginTop: 20,
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, rgba(34,211,238,0.2), rgba(59,130,246,0.2))',
                  border: '1px solid rgba(34,211,238,0.4)',
                  borderRadius: 8,
                  color: '#22D3EE',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                {t('inventory.goToShop')}
              </button>
            </div>
          )}

          {!loading && user && Object.keys(itemsByCategory).length > 0 && (
            Object.entries(itemsByCategory).map(([categoryId, categoryItems]) => {
              const category = categories.find(c => c.id === categoryId)
              const displayName = getCategoryName(categoryId, t)
              const icon = category?.icon || '📦'
              const color = category?.color || '#22D3EE'
              
              return (
                <React.Fragment key={categoryId}>
                  <h3 style={{ 
                    fontSize: 18, 
                    fontWeight: 600, 
                    color: color,
                    textShadow: `0 0 20px ${color}80`,
                    marginTop: 20,
                    marginBottom: 12
                  }}>
                    {icon} {displayName} ({categoryItems.length})
                  </h3>
                  <div className="shop-grid">
                    {categoryItems.map(item => (
                      <Card 
                        key={item.id} 
                        item={item} 
                        onUse={handleUse}
                        using={using[item.id]}
                        onPreview={isMusicCategory(item.type) ? handlePreview : undefined}
                        isPreviewing={previewingId === item.id}
                      />
                    ))}
                  </div>
                </React.Fragment>
              )
            })
          )}
        </main>
      </div>

      {modalOpen && (
        <div className="mp-modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="mp-modal" style={{
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))',
            backdropFilter: 'blur(32px)',
            border: '2px solid rgba(34, 211, 238, 0.3)',
            borderRadius: 20,
            padding: 32,
            maxWidth: 420,
            width: '90%',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(34, 211, 238, 0.15)',
            animation: 'slideUp 0.3s ease'
          }}>
            <div style={{
              fontSize: 48,
              textAlign: 'center',
              marginBottom: 20,
              filter: 'drop-shadow(0 4px 12px rgba(34, 211, 238, 0.4))'
            }}>
              {modalTitle === t('inventory.modalSuccess') ? '✨' : modalTitle === t('inventory.modalError') ? '⚠️' : 'ℹ️'}
            </div>
            <h3 className="mp-modal-title" style={{
              color: modalTitle === t('inventory.modalSuccess') ? '#22D3EE' : modalTitle === t('inventory.modalError') ? '#EF4444' : '#FCD34D',
              fontSize: 24,
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: 16,
              textShadow: `0 0 20px ${modalTitle === t('inventory.modalSuccess') ? 'rgba(34, 211, 238, 0.5)' : modalTitle === t('inventory.modalError') ? 'rgba(239, 68, 68, 0.5)' : 'rgba(252, 211, 77, 0.5)'}`,
              letterSpacing: '1px'
            }}>
              {modalTitle}
            </h3>
            <p className="mp-modal-message" style={{
              color: '#E2E8F0',
              fontSize: 16,
              lineHeight: 1.6,
              textAlign: 'center',
              marginBottom: 24
            }}>
              {modalMessage}
            </p>
            <div className="mp-modal-actions">
              <button className="mp-modal-btn mp-modal-btn-primary" onClick={() => closeModal()} style={{
                width: '100%',
                padding: '14px 24px',
                background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2))',
                border: '2px solid rgba(34, 211, 238, 0.4)',
                borderRadius: 12,
                color: '#22D3EE',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 211, 238, 0.3), rgba(59, 130, 246, 0.3))'
                e.currentTarget.style.borderColor = '#22D3EE'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(34, 211, 238, 0.4)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }} onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(34, 211, 238, 0.2), rgba(59, 130, 246, 0.2))'
                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.transform = 'translateY(0)'
              }}>
                {t('inventory.modalOk')}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Filter Button */}
      <button 
        className="inventory-filter-toggle-mobile"
        onClick={openFilterPopup}
        aria-label={t('inventory.filterTitle')}
      >
        <span>⚙️</span>
        {activeFilterCount > 0 && (
          <span className="filter-badge">{activeFilterCount}</span>
        )}
      </button>
      
      {/* Mobile Filter Popup */}
      <div 
        className={`inventory-filter-popup-overlay ${filterPopupOpen ? 'open' : ''}`}
        onClick={() => setFilterPopupOpen(false)}
      >
        <div 
          className="inventory-filter-popup"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="inventory-filter-popup-header">
            <h3>{t('inventory.filterTitle')}</h3>
            <button 
              className="inventory-filter-popup-close"
              onClick={() => setFilterPopupOpen(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="inventory-filter-popup-content">
            {/* Search */}
            <div>
              <label>{t('inventory.search')}</label>
              <input 
                type="search"
                placeholder={t('inventory.search')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            
            {/* Type filter */}
            <div>
              <label>{t('inventory.filterType')}</label>
              <select value={tempType} onChange={(e) => setTempType(e.target.value)}>
                <option value="all">{t('inventory.all')}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {getCategoryName(cat.id, t)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Rarity filter */}
            <div>
              <label>{t('inventory.filterRarity')}</label>
              <select value={tempRarity} onChange={(e) => setTempRarity(e.target.value)}>
                <option value="all">{t('inventory.all')}</option>
                <option value="common">{t('inventory.rarityCommon')}</option>
                <option value="rare">{t('inventory.rarityRare')}</option>
                <option value="epic">{t('inventory.rarityEpic')}</option>
                <option value="legendary">{t('inventory.rarityLegendary')}</option>
              </select>
            </div>
            
            {/* Status filter */}
            <div>
              <label>{t('inventory.filterStatus')}</label>
              <select value={tempEquipped} onChange={(e) => setTempEquipped(e.target.value)}>
                <option value="all">{t('inventory.all')}</option>
                <option value="equipped">{t('inventory.statusEquipped')}</option>
                <option value="unequipped">{t('inventory.statusUnequipped')}</option>
              </select>
            </div>
          </div>
          
          <div className="inventory-filter-popup-actions">
            <button className="inventory-filter-reset" onClick={resetFilters}>
              {t('common.reset')}
            </button>
            <button className="inventory-filter-apply" onClick={applyFilters}>
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
