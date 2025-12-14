import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'
import { AudioManager } from '../lib/AudioManager'
import SkillPackageSection from '../components/shop/SkillPackageSection'
import '../components/shop/SkillPackageSection.css'
import { MobileBreadcrumb, MobileQuickSettings } from '../components/layout'

type Item = {
  id: string
  title: string
  title_en?: string
  title_zh?: string
  title_ja?: string
  subtitle?: string
  subtitle_en?: string
  subtitle_zh?: string
  subtitle_ja?: string
  price: number
  currency?: 'coin' | 'gem'
  media_url?: string
  rarity?: string
  type?: string
  item_code?: string
}

type Category = {
  id: string
  name_vi: string
  name_en?: string
  description?: string
  icon?: string
  color?: string
  sort_order: number
  item_count?: number
}

type LanguageCode = 'vi' | 'en' | 'zh' | 'ja'

function pickText(language: LanguageCode, vi?: string | null, en?: string | null, zh?: string | null, ja?: string | null): string {
  switch (language) {
    case 'en': return en || vi || zh || ja || ''
    case 'zh': return zh || en || vi || ja || ''
    case 'ja': return ja || en || vi || zh || ''
    default: return vi || en || zh || ja || ''
  }
}

// Note: These sample items use i18n keys for title/desc
const sampleSkins: Item[] = [
  { id: 'skin1', item_code: 'skin1', title: 'Quân Cờ Gỗ Cổ Điển', subtitle: 'Gỗ cổ điển truyền thống', price: 0, currency: 'coin', media_url: '' },
  { id: 'skin2', item_code: 'skin2', title: 'Quân Cờ Ngọc Bích', subtitle: 'Quân cờ ngọc bích quý giá', price: 250, currency: 'coin', media_url: '' },
  { id: 'skin3', item_code: 'skin3', title: 'Quân Cờ Hoàng Kim', subtitle: 'Quân cờ vàng huyền thoại', price: 50, currency: 'gem', media_url: '' }
]

const sampleBoards: Item[] = [
  { id: 'board1', item_code: 'board1', title: 'Bàn Cờ Cổ Điển', subtitle: 'Bàn gỗ truyền thống', price: 0, currency: 'coin', media_url: '' },
  { id: 'board2', item_code: 'board2', title: 'Bàn Cờ Hoa Anh Đào', subtitle: 'Bàn cờ hoa anh đào Nhật Bản', price: 600, currency: 'coin', media_url: '' },
  { id: 'board3', item_code: 'board3', title: 'Bàn Cờ Vũ Trụ', subtitle: 'Bàn cờ không gian vũ trụ', price: 120, currency: 'gem', media_url: '' }
]

// UI-level capitalization helper (first letter uppercase; preserves other text)
function capitalize(str: string): string {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Helper to get category display name via i18n "shop.type.<id>"
function getCategoryName(categoryId: string, t: (key: string) => string): string {
  const normalized = (categoryId || '').trim().toLowerCase()
  // NOTE: "title" (danh hiệu) đã bị loại bỏ khỏi shop vì danh hiệu phải đạt được qua thành tích,
  // không phải mua. Danh hiệu được quản lý qua hệ thống Achievement/Rank.
  const mapping: Record<string, string> = {
    piece_skin: 'shop.typePieceSkin',
    skin_piece: 'shop.typePieceSkin',
    board_skin: 'shop.typeBoardSkin',
    skin_board: 'shop.typeBoardSkin',
    avatar_frame: 'shop.typeAvatarFrame',
    music: 'shop.typeMusic',
    'âm nhạc': 'shop.typeMusic',
    // title: REMOVED - Danh hiệu không bán, phải đạt được qua thành tích
    emote: 'shop.typeEmote',
    pass: 'shop.typePass',
    package: 'shop.typePackage',
    gifts: 'shop.typeGifts'
  }

  const candidates = [
    mapping[normalized],
    `shop.type.${normalized}`,
    `shop.type${normalized.split('_').map(capitalize).join('')}`
  ].filter(Boolean) as string[]

  for (const key of candidates) {
    const translated = t(key)
    if (translated && translated !== key) {
      return capitalize(translated)
    }
  }

  return capitalize((normalized || categoryId || '').replace(/_/g, ' '))
}

// Validate media URL
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

function resolveItemText(
  item: Item,
  language: LanguageCode,
  t: (key: string) => string,
  kind: 'title' | 'desc'
) {
  const code = item.item_code || item.id
  const key = `shop.item.${code}.${kind}`
  const translated = t(key)
  const normalized = translated?.toLowerCase()
  const hasRealTranslation = translated && translated !== key && normalized !== kind

  if (hasRealTranslation) return translated

  const vi = kind === 'title' ? item.title : item.subtitle
  const en = kind === 'title' ? item.title_en : item.subtitle_en
  const zh = kind === 'title' ? item.title_zh : item.subtitle_zh
  const ja = kind === 'title' ? item.title_ja : item.subtitle_ja
  const localized = pickText(language, vi, en, zh, ja)
  const direct = typeof vi === 'string' ? vi : ''
  return localized || direct || code
}

function Card({ item, onBuy, owned, buying, profile, openInfo, openConfirm, dataTour }: { item: Item; onBuy: (it: Item)=>Promise<{ok: boolean; message?: string}> | Promise<any>; owned?: boolean; buying?: boolean; profile?: any; openInfo: (title: string, msg: string)=>Promise<void>; openConfirm: (title: string, msg: string)=>Promise<boolean>; dataTour?: string }) {
  const { t, language } = useLanguage()
  const [hover, setHover] = React.useState(false)
  const [pos, setPos] = React.useState<{ left: number; top: number; width: number; height: number; side: 'left' | 'right' }>({ left: 0, top: 0, width: 280, height: 160, side: 'right' })
  // larger preview popup requested: ~1.5x previous
  const previewW = 340 // target width (320-360)
  const previewH = 210 // target height (200-220)
  const isVideo = item.media_url && item.media_url.endsWith('.mp4')

  // affordability check used for rendering and click-time validation
  const canAfford = (item.price ?? 0) <= 0 || (profile && ((item.currency === 'coin' && (profile.coins ?? 0) >= item.price) || (item.currency === 'gem' && (profile.gems ?? 0) >= item.price)))

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

  // refs for rAF/throttle mouse handling
  const latestMouse = React.useRef<{ x: number; y: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const lastTimeRef = React.useRef<number>(0)
  const minInterval = 40 // ms minimum between updates

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
      // schedule another frame and exit — keeps rate limited
      rafRef.current = requestAnimationFrame(processMouse)
      return
    }
    lastTimeRef.current = now

    const margin = 12
    const x = coords.x
    const y = coords.y
    const winW = window.innerWidth

    // available space on each side
    const rightSpace = winW - x - margin
    const leftSpace = x - margin

    // choose side: prefer right if enough space, else left
    let side: 'left' | 'right' = rightSpace >= previewW ? 'right' : (leftSpace >= previewW ? 'left' : (rightSpace >= leftSpace ? 'right' : 'left'))

    // desired width is previewW, but if not enough space, scale down
    const avail = side === 'right' ? rightSpace : leftSpace
    const minW = 320
    const maxW = 360
    // clamp into requested range but prefer previewW when possible
    let width = Math.max(minW, Math.min(previewW, avail))
    if (width > maxW) width = maxW
    // compute scale by width/previewW
    const scale = width / previewW
    const height = Math.max(100, Math.round(previewH * scale))

    const left = side === 'right' ? x + margin : x - width - margin

    // clamp top so popup stays in viewport
    let top = y - height / 2
    const minTop = 8
    const maxTop = window.innerHeight - height - 8
    if (top < minTop) top = minTop
    if (top > maxTop) top = maxTop

    setPos({ left, top, width, height, side })

    // clear stored coords — next mousemove will refill
    latestMouse.current = null
    rafRef.current = null
  }

  function handleMouseMove(e: React.MouseEvent) {
    // disable preview on small screens
    if (window.innerWidth <= 600) return

    latestMouse.current = { x: e.clientX, y: e.clientY }
    if (rafRef.current == null) {
      rafRef.current = requestAnimationFrame(processMouse)
    }
  }

  const [clickedDbg, setClickedDbg] = React.useState(false)
  async function handleCardClickDebug(e: React.MouseEvent) {
    // lightweight debug: log the click and briefly flash the card so user can see it registered
    console.log('shop-card clicked (debug)', item.id, e.target)
    setClickedDbg(true)
    setTimeout(() => setClickedDbg(false), 450)
  }

  // NOTE: modal helpers `openInfo` and `openConfirm` are provided by parent `Shop` component

  return (
    <div className={`shop-card ${clickedDbg ? 'debug-clicked' : ''}`} data-tour={dataTour} onClick={handleCardClickDebug} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onMouseMove={handleMouseMove}>
      <div className="shop-card-media">
        {item.rarity && <div className={`rarity-badge ${item.rarity ? `rarity-${item.rarity}` : ''}`}>{rarityLabel(item.rarity)}</div>}
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
            const langCode = language as LanguageCode
            return resolveItemText(item, langCode, t, 'title')
          })()
        }</div>
        <div className="shop-card-sub">{
          (() => {
            const langCode = language as LanguageCode
            return resolveItemText(item, langCode, t, 'desc')
          })()
        }</div>
        <div className="shop-card-footer">
          <div className="shop-card-price" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.price === 0 ? t('shop.free') : (
              <>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{item.price}</span>
                <img 
                  src={item.currency === 'gem' ? '/gem.png' : '/coin.png'} 
                  alt={item.currency === 'gem' ? t('shop.gems') : t('shop.coins')} 
                  style={{ width: 18, height: 18, objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${item.currency === 'gem' ? 'rgba(34, 211, 238, 0.4)' : 'rgba(251, 191, 36, 0.4)'})` }} 
                />
              </>
            )}
          </div>
          <button
            className="shop-buy"
            data-tour={dataTour === 'free-chess' ? 'buy-chess-btn' : dataTour === 'free-board' ? 'buy-board-btn' : undefined}
            style={{ pointerEvents: 'auto', opacity: (owned || buying) ? 0.6 : (canAfford ? 1 : 0.6), cursor: (owned || buying) ? 'not-allowed' : (canAfford ? 'pointer' : 'not-allowed') }}
            disabled={Boolean(buying) || Boolean(owned)}
            onClick={async (e) => {
              e.stopPropagation()
              console.log('shop-buy clicked', item.id)

              // If the item costs > 0 and we don't have a loaded profile, ask user to sign in (modal)
              if ((item.price ?? 0) > 0 && !profile) {
                await openInfo(t('shop.needLogin'), t('shop.loginMessage'))
                return
              }

              // If user can't afford, show a friendly modal and stop
              if (!(canAfford)) {
                const cur = item.currency === 'gem' ? t('shop.gems') : t('shop.coins')
                await openInfo(t('shop.notEnoughCurrency'), t('shop.notEnoughCurrencyMessage', { currency: cur }))
                return
              }

              const label = item.price === 0 ? t('shop.buy') : `${t('shop.buy')} (${item.price} ${item.currency === 'gem' ? t('shop.gems') : t('shop.coins')})`
              const ok = await openConfirm(t('shop.confirmPurchase'), t('shop.confirmPurchaseMessage', { action: label }))
              if (!ok) return
              if (!onBuy) return
              try {
                const res = await onBuy(item)
                // support both boolean or {ok,message}
                let okRes = false
                let msg: string | undefined = undefined
                if (typeof res === 'object' && res !== null && 'ok' in res) {
                  okRes = !!res.ok
                  msg = res.message
                } else if (typeof res === 'boolean') {
                  okRes = res
                } else {
                  okRes = true
                }
                if (okRes) {
                  AudioManager.playSoundEffect('purchase')
                  await openInfo(t('shop.purchaseSuccess'), t('shop.purchaseSuccessMessage', { item: item.title }))
                } else {
                  await openInfo(t('shop.purchaseFailed'), msg || t('shop.purchaseFailed'))
                }
              } catch (err: any) {
                console.error('onBuy threw', err)
                await openInfo(t('common.error'), t('common.error') + ': ' + (err?.message ?? String(err)))
              }
            }}
          >
            {owned ? t('shop.owned') : (buying ? t('common.loading') : t('shop.buy'))}
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
            <video src={item.media_url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <img src={item.media_url} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        ) : (
          <div className="shop-card-preview-fallback">{t('shop.noPreview')}</div>
        )}
        <div className="shop-card-preview-meta">
          <div className="shop-card-preview-price" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.price === 0 ? t('shop.free') : (
              <>
                <span>{item.price}</span>
                <img 
                  src={item.currency === 'gem' ? '/gem.png' : '/coin.png'} 
                  alt={item.currency === 'gem' ? t('shop.gems') : t('shop.coins')} 
                  style={{ width: 16, height: 16, objectFit: 'contain' }} 
                />
                <span style={{ fontSize: 11 }}>{item.currency === 'gem' ? t('shop.gems') : t('shop.coins')}</span>
              </>
            )}
          </div>
        </div>
      </div>
      {/* modal is global in parent Shop component */}
    </div>
  )
}

export default function Shop() {
  const { t, language } = useLanguage()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [collectionFilter, setCollectionFilter] = useState<'all' | 'sale' | 'gifts' | 'package'>('all')
  const [rarity, setRarity] = useState('all')
  const [priceCurrency, setPriceCurrency] = useState('all')
  // (slider removed) price filters use currency and global sort only
  
  // Dynamic grouped items: key = category, value = array of items
  const [itemsByCategory, setItemsByCategory] = useState<Record<string, Item[]>>({})
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  
  const [user, setUser] = useState<any | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [ownedIds, setOwnedIds] = useState<Record<string, boolean>>({})
  const [purchasing, setPurchasing] = useState<Record<string, boolean>>({})
  // global sort applied to all sections (single control in sidebar)
  const [globalSort, setGlobalSort] = useState<'none' | 'price_asc' | 'price_desc'>('none')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchDebug, setFetchDebug] = useState<string | null>(null)
  
  // Mobile filter popup state
  const [filterPopupOpen, setFilterPopupOpen] = useState(false)
  // Temp filter values for popup (apply on confirm)
  const [tempType, setTempType] = useState('all')
  const [tempRarity, setTempRarity] = useState('all')
  const [tempPriceCurrency, setTempPriceCurrency] = useState('all')
  const [tempGlobalSort, setTempGlobalSort] = useState<'none' | 'price_asc' | 'price_desc'>('none')
  
  // Count active filters for badge
  const activeFilterCount = [
    type !== 'all' ? 1 : 0,
    rarity !== 'all' ? 1 : 0,
    priceCurrency !== 'all' ? 1 : 0,
    globalSort !== 'none' ? 1 : 0
  ].reduce((a, b) => a + b, 0)
  
  // Open filter popup with current values
  const openFilterPopup = () => {
    setTempType(type)
    setTempRarity(rarity)
    setTempPriceCurrency(priceCurrency)
    setTempGlobalSort(globalSort)
    setFilterPopupOpen(true)
  }
  
  // Apply filters from popup
  const applyFilters = () => {
    setType(tempType)
    setRarity(tempRarity)
    setPriceCurrency(tempPriceCurrency)
    setGlobalSort(tempGlobalSort)
    setFilterPopupOpen(false)
  }
  
  // Reset filters
  const resetFilters = () => {
    setTempType('all')
    setTempRarity('all')
    setTempPriceCurrency('all')
    setTempGlobalSort('none')
  }
  

  // Load categories from DB
  useEffect(() => {
    let cancelled = false
    async function loadCategories() {
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('id, name_vi, name_en, description, icon, color, sort_order')
          .eq('is_active', true)
          .order('sort_order')
        
        if (!cancelled && !error && data) {
          // Loại bỏ category "title" - danh hiệu không bán trong shop
          const filteredCategories = data.filter((c: Category) => {
            const id = (c.id || '').toLowerCase()
            return id !== 'title' && id !== 'titles'
          })
          setCategories(filteredCategories)
        }
      } catch (err) {
        console.warn('Failed to load categories:', err)
      }
    }
    loadCategories()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (type === 'all') return
    const availableIds = categories.map(c => c.id)
    if (!availableIds.includes(type)) {
      setType('all')
    }
  }, [type, categories])

  useEffect(() => {
    // fetch items from Supabase when filters change
    let cancelled = false
    const fetchItems = async () => {
      setLoading(true)
      setError(null)
      setFetchDebug(null)
      try {
        // Read from the actual `items` table (schema uses plural `items`).
        // Map columns from items -> UI Item shape. use `preview_url` (exists in schema)
        // Fetch with name_en for multi-language search
        let qb: any = supabase.from('items').select('id,name,description,price_coins,price_gems,category,rarity,is_available,item_code,preview_url,name_en,name_zh,name_ja,description_en,description_zh,description_ja')
        if (type !== 'all') {
          // Filter by exact category match when specific type selected
          qb = qb.eq('category', type)
        }
        if (rarity !== 'all') qb = qb.eq('rarity', rarity)
        // Remove server-side search - will filter client-side for i18n support
        qb = qb.order ? qb.order('created_at', { ascending: false }) : qb

        const { data, error } = await qb
        if (error) throw error
        if (!cancelled && Array.isArray(data)) {
          const lang = language as LanguageCode
          const mapped = data.map((i: any) => {
            const priceCoins = Number(i.price_coins ?? 0)
            const priceGems = Number(i.price_gems ?? 0)
            const currency = priceGems > 0 ? 'gem' : 'coin'
            const price = priceGems > 0 ? priceGems : priceCoins
            const cat: string = (i.category || 'other').toString().trim()
            const code: string = (i.item_code || i.id || '').toString()
            const titleVi = i.name || code || 'Item'
            const titleEn = i.name_en || ''
            const titleZh = i.name_zh || ''
            const titleJa = i.name_ja || ''
            const descVi = i.description || ''
            const descEn = i.description_en || ''
            const descZh = i.description_zh || ''
            const descJa = i.description_ja || ''
            return {
              id: i.id,
              // Store raw for fallback, but prefer i18n keys by code
              title: pickText(lang, titleVi, titleEn, titleZh, titleJa) || titleVi,
              title_en: titleEn,
              title_zh: titleZh,
              title_ja: titleJa,
              subtitle: pickText(lang, descVi, descEn, descZh, descJa) || descVi,
              subtitle_en: descEn,
              subtitle_zh: descZh,
              subtitle_ja: descJa,
              price,
              currency: currency as 'coin' | 'gem',
              media_url: i.preview_url || '',
              type: cat, // use category directly as type
              rarity: i.rarity,
              item_code: code
            }
          })

          if (mapped.length === 0) {
            // Không có sản phẩm - hiển thị empty state thay vì lỗi
            setError(null)
            setFetchDebug(null)
            setItemsByCategory({})
            setAvailableCategories([])
            return
          }

          // Loại bỏ category "title" - danh hiệu phải đạt được qua thành tích, không bán
          let filtered = mapped.filter((it: any) => {
            const cat = (it.type || '').toLowerCase()
            return cat !== 'title' && cat !== 'titles'
          })
          
          // apply client-side price filters (currency)
          if (priceCurrency !== 'all') {
            filtered = filtered.filter((it: any) => it.currency === priceCurrency)
          }
          
          // Client-side search with i18n support
          if (query && query.trim()) {
            const q = query.trim().toLowerCase()
            filtered = filtered.filter((it: any) => {
              // Search in original name
              const nameMatch = (it.title || '').toLowerCase().includes(q)
              // Search in English name
              const nameEnMatch = (it.title_en || '').toLowerCase().includes(q)
              const nameZhMatch = (it.title_zh || '').toLowerCase().includes(q)
              const nameJaMatch = (it.title_ja || '').toLowerCase().includes(q)
              // Search in i18n translated name
              const code = it.item_code || it.id
              const i18nKey = `shop.item.${code}.title`
              const i18nName = t(i18nKey)
              const i18nMatch = i18nName !== i18nKey && i18nName.toLowerCase().includes(q)
              // Search in description too
              const descMatch = (it.subtitle || '').toLowerCase().includes(q)
              const descEnMatch = (it.subtitle_en || '').toLowerCase().includes(q)
              const descZhMatch = (it.subtitle_zh || '').toLowerCase().includes(q)
              const descJaMatch = (it.subtitle_ja || '').toLowerCase().includes(q)
              return nameMatch || nameEnMatch || nameZhMatch || nameJaMatch || i18nMatch || descMatch || descEnMatch || descZhMatch || descJaMatch
            })
          }

          // Apply marketing / collection filter (sale, gifts, etc.) after basic filters
          const marketingFiltered = (() => {
            switch (collectionFilter) {
              case 'sale':
                return filtered.filter((item: Item) => (item.price ?? 0) > 0)
              case 'gifts':
                return filtered.filter((item: Item) => (item.price ?? 0) === 0)
              case 'package':
                // Package tab chỉ hiển thị SkillPackageSection, không filter items
                return []
              default:
                return filtered
            }
          })()

          const displayItems = marketingFiltered.length > 0 ? marketingFiltered : filtered

          // Group items by category dynamically
          const grouped: Record<string, Item[]> = {}
          const categories = new Set<string>()
          
          displayItems.forEach((item: Item) => {
            const cat = item.type || 'other'
            categories.add(cat)
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(item)
          })

          setItemsByCategory(grouped)
          setAvailableCategories(Array.from(categories).sort())
        }
      } catch (err: any) {
        // show detailed debug and fallback to sample data to avoid empty UI
        console.warn('Shop fetch from `items` failed:', err)
        const friendly = err?.message ?? 'Không thể tải dữ liệu từ server'
        setError(friendly)
        setFetchDebug(err?.message ? `Tried table: items — ${err.message}` : JSON.stringify(err))
        
        // Fallback: group sample data by type
        const fallbackGrouped: Record<string, Item[]> = {
          skin_piece: sampleSkins,
          skin_board: sampleBoards
        }
        setItemsByCategory(fallbackGrouped)
        setAvailableCategories(['skin_piece', 'skin_board'])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchItems()
    return () => { cancelled = true }
  }, [query, type, rarity, priceCurrency, collectionFilter, language])

  // load current user & profile & owned items
  useEffect(() => {
    let mounted = true
    const loadUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        const u = data?.user ?? null
        if (!mounted) return
        setUser(u)
        if (u) {
          const { data: prof, error: profErr } = await supabase.from('profiles').select('coins,gems,user_id').eq('user_id', u.id).maybeSingle()
          if (profErr) console.warn('profile load failed', profErr)
          if (mounted && prof) setProfile(prof)
          const { data: ui, error: uiErr } = await supabase.from('user_items').select('item_id').eq('user_id', u.id)
          if (uiErr) console.warn('owned items load failed', uiErr)
          if (mounted && Array.isArray(ui)) {
            const map: Record<string, boolean> = {}
            ui.forEach((r: any) => { if (r.item_id) map[r.item_id] = true })
            setOwnedIds(map)
          }
        }
      } catch (e) {
        console.warn('auth/profile load err', e)
      }
    }
    loadUser()
    return () => { mounted = false }
  }, [])

  // helper: refresh profile & owned list after purchase
  async function refreshUserState() {
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      setUser(u)
      if (!u) return
      const { data: prof } = await supabase.from('profiles').select('coins,gems,user_id').eq('user_id', u.id).maybeSingle()
      if (prof) {
        setProfile(prof)
        // Dispatch event to update header coins/gems display
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: {
            field: 'currency',
            coins: prof.coins,
            gems: prof.gems
          }
        }))
      }
      const { data: ui } = await supabase.from('user_items').select('item_id').eq('user_id', u.id)
      if (Array.isArray(ui)) {
        const map: Record<string, boolean> = {}
        ui.forEach((r: any) => { if (r.item_id) map[r.item_id] = true })
        setOwnedIds(map)
      }
    } catch (err) {
      console.warn('refreshUserState err', err)
    }
  }

  async function handleBuy(item: Item) {
    let uid: string | null = null
    try {
      const { data } = await supabase.auth.getUser()
      const u = data?.user ?? null
      if (!u) {
        return { ok: false, message: t('shop.loginMessage') }
      }
      uid = u.id
      // keep local state in sync
      setUser(u)
    } catch (e) {
      console.warn('auth read err', e)
      return { ok: false, message: t('common.error') }
    }
    const id = item.id
    setPurchasing(prev => ({ ...prev, [id]: true }))
    try {
      if (ownedIds[id]) {
        return { ok: false, message: t('shop.owned') }
      }

      // ensure profile exists to satisfy FK on user_items
      async function ensureProfileExists(userId: string | null) {
        if (!userId) return null
        const { data: existing, error: exErr } = await supabase.from('profiles').select('user_id,coins,gems').eq('user_id', userId).maybeSingle()
        if (exErr) {
          console.warn('profile check error', exErr)
        }
        if (existing) return existing
        // attempt to create a minimal profile row (RLS allows insert when auth.uid() == user_id)
        const { error: insErr } = await supabase.from('profiles').insert({ user_id: userId, coins: 0, gems: 0 })
        if (insErr) {
          console.warn('profile create failed', insErr)
          return null
        }
        // refetch
        const { data: newProf } = await supabase.from('profiles').select('user_id,coins,gems').eq('user_id', userId).maybeSingle()
        return newProf
      }

      // free item -> just insert (ensure profile exists first)
      await ensureProfileExists(uid)
      if ((item.price ?? 0) <= 0) {
        // use upsert to avoid duplicate key errors if the row already exists
        const { error: errInsert } = await supabase.from('user_items').upsert([{ user_id: uid, item_id: item.id }], { onConflict: 'user_id,item_id' })
        if (errInsert) {
          // treat unique-constraint as already-owned
          if (/duplicate key value|unique constraint/i.test(errInsert.message || '')) {
            await refreshUserState()
            return { ok: false, message: t('shop.alreadyOwned') }
          }
          throw errInsert
        }
        await refreshUserState()
        return { ok: true }
      }

      // paid item -> check profile funds (ensure profile exists)
      const prof = await ensureProfileExists(uid)
      if (!prof) {
        console.error('Cannot load/create profile for user', uid)
        return { ok: false, message: t('shop.dbError') + 'Profile not found' }
      }
      
      const coins = Number(prof?.coins ?? 0)
      const gems = Number(prof?.gems ?? 0)
      console.log('[Shop] Current balance:', { coins, gems, itemPrice: item.price, currency: item.currency })
      
      if (item.currency === 'coin' && coins < item.price) {
        return { ok: false, message: t('shop.notEnoughCoins') }
      }
      if (item.currency === 'gem' && gems < item.price) {
        return { ok: false, message: t('shop.notEnoughGems') }
      }

      // attempt deduct and assign (optimistic)
      if (item.currency === 'coin') {
        const newCoins = coins - item.price
        console.log('[Shop] Deducting coins:', { oldCoins: coins, newCoins, price: item.price })
        const { data: updateData, error: updErr } = await supabase
          .from('profiles')
          .update({ coins: newCoins })
          .eq('user_id', uid)
          .select('coins')
        console.log('[Shop] Coin update result:', { updateData, updErr })
        if (updErr) {
          console.error('[Shop] Failed to deduct coins:', updErr)
          throw updErr
        }
        // Cập nhật local + header ngay lập tức (tránh chờ refresh/realtime)
        setProfile((prev: any) => ({ ...(prev || {}), coins: newCoins, gems }))
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: { field: 'currency', coins: newCoins, gems }
        }))
      } else if (item.currency === 'gem') {
        const newGems = gems - item.price
        console.log('[Shop] Deducting gems:', { oldGems: gems, newGems, price: item.price })
        const { data: updateData, error: updErr } = await supabase
          .from('profiles')
          .update({ gems: newGems })
          .eq('user_id', uid)
          .select('gems')
        console.log('[Shop] Gem update result:', { updateData, updErr })
        if (updErr) {
          console.error('[Shop] Failed to deduct gems:', updErr)
          throw updErr
        }
        // Cập nhật local + header ngay lập tức
        setProfile((prev: any) => ({ ...(prev || {}), gems: newGems, coins }))
        window.dispatchEvent(new CustomEvent('profileUpdated', {
          detail: { field: 'currency', coins, gems: newGems }
        }))
      }

      const { error: insErr } = await supabase.from('user_items').upsert([{ user_id: uid, item_id: item.id }], { onConflict: 'user_id,item_id' })
      if (insErr) {
        if (/duplicate key value|unique constraint/i.test(insErr.message || '')) {
          // someone else inserted it concurrently — treat as success
          await refreshUserState()
          return { ok: true }
        } else {
          throw insErr
        }
      } else {
        await refreshUserState()
        return { ok: true }
      }
    } catch (err: any) {
      console.error('purchase failed', err)
      console.error('purchase err raw:', err)
      const msg = err?.message || String(err)
      if (msg && /foreign key constraint/i.test(msg)) {
        return { ok: false, message: t('shop.dbError') + msg }
      } else if (msg && /duplicate key value|unique constraint/i.test(msg)) {
        // already owned — refresh state and inform user
        await refreshUserState()
        return { ok: true }
      } else {
        return { ok: false, message: t('shop.cannotPurchase') + msg }
      }
    } finally {
      setPurchasing(prev => ({ ...prev, [id]: false }))
    }
  }

  // Global modal state and helpers (rendered here so the overlay sits above everything)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState<string | null>(null)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const [modalMode, setModalMode] = useState<'confirm' | 'info'>('info')
  const modalResolveRef = React.useRef<((val: boolean) => void) | null>(null)

  function openConfirm(title: string, message: string) {
    return new Promise<boolean>((resolve) => {
      modalResolveRef.current = resolve
      setModalTitle(title)
      setModalMessage(message)
      setModalMode('confirm')
      setModalOpen(true)
    })
  }

  function openInfo(title: string, message: string) {
    return new Promise<void>((resolve) => {
      modalResolveRef.current = () => {
        resolve()
        return true
      }
      setModalTitle(title)
      setModalMessage(message)
      setModalMode('info')
      setModalOpen(true)
    })
  }

  function closeModal(result: boolean) {
    const r = modalResolveRef.current
    modalResolveRef.current = null
    setModalOpen(false)
    setModalTitle(null)
    setModalMessage(null)
    try { if (r) r(result) } catch (e) { /* ignore */ }
  }

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
          {t('breadcrumb.shop')}
        </span>
      </div>
      
      {/* Mobile Category Pills */}
      <div className="shop-category-pills-mobile">
        <button 
          className={`category-pill ${collectionFilter === 'all' ? 'active' : ''}`} 
          onClick={() => setCollectionFilter('all')}
        >
          {t('shop.categoryAll')}
        </button>
        <button 
          className={`category-pill ${collectionFilter === 'sale' ? 'active' : ''}`} 
          onClick={() => setCollectionFilter('sale')}
        >
          🔥 {t('shop.categorySaleHot')}
        </button>
        <button 
          className={`category-pill ${collectionFilter === 'gifts' ? 'active' : ''}`} 
          onClick={() => setCollectionFilter('gifts')}
        >
          🎁 {t('shop.categoryGiftsCurrency')}
        </button>
        <button 
          className={`category-pill ${collectionFilter === 'package' ? 'active' : ''}`} 
          onClick={() => setCollectionFilter('package')}
        >
          📦 {t('shop.categoryPackage')}
        </button>
      </div>
      
      <div className="shop-page" style={{ gap: 18 }}>
        <aside className="panel shop-sidebar">
          {/* Category pills matching mock (All, Sale & Hot, GIFTS, Pass, Package) */}
          <div style={{ marginBottom: 8 }}>
            <div className="category-pills">
              <button className={`category-pill ${collectionFilter === 'all' ? 'active' : ''}`} onClick={() => setCollectionFilter('all')}>{t('shop.categoryAll')}</button>
              <button className={`category-pill ${collectionFilter === 'sale' ? 'active' : ''}`} onClick={() => setCollectionFilter('sale')}>{t('shop.categorySaleHot')}</button>
              <button className={`category-pill ${collectionFilter === 'gifts' ? 'active' : ''}`} onClick={() => setCollectionFilter('gifts')}>{t('shop.categoryGiftsCurrency')}</button>
              <button className={`category-pill ${collectionFilter === 'package' ? 'active' : ''}`} onClick={() => setCollectionFilter('package')}>{t('shop.categoryPackage')}</button>
            </div>
          </div>

          

          <div style={{ marginTop: 12 }}>
            <input className="sidebar-search" placeholder={t('shop.searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <div style={{ marginTop: 12 }} />

          <div className="shop-filters" style={{ marginTop: 12 }}>
            <label>{t('shop.filterType')}</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="all">{capitalize(t('shop.typeAll'))}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {getCategoryName(cat.id, t)}
                </option>
              ))}
            </select>

            <label style={{ marginTop: 8 }}>{t('shop.filterRarity')}</label>
            <select value={rarity} onChange={e => setRarity(e.target.value)}>
              <option value="all">{t('common.all')}</option>
              <option value="common">{t('shop.rarityCommon')}</option>
              <option value="rare">{t('shop.rarityRare')}</option>
              <option value="legendary">{t('shop.rarityLegendary')}</option>
            </select>

            {/* Price filter block (mock shows price filters) */}
            <label style={{ marginTop: 8 }}>{t('shop.filterPrice')}</label>
            <div className="price-filters">
              <select value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)}>
                <option value="all">{t('common.all')}</option>
                <option value="coin">{t('shop.coins')}</option>
                <option value="gem">{t('shop.gems')}</option>
              </select>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>{t('shop.sortLabel')}</label>
                <select value={globalSort} onChange={e => setGlobalSort(e.target.value as any)} style={{ width: '100%', marginTop: 6 }}>
                  <option value="none">{t('shop.sortDefault')}</option>
                  <option value="price_asc">{t('shop.sortPriceAsc')}</option>
                  <option value="price_desc">{t('shop.sortPriceDesc')}</option>
                </select>
              </div>
              {/* slider removed per request — no numeric price bounds UI */}
            </div>
          </div>
        </aside>
        

        <main className="panel shop-main">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>{t('shop.pageTitle')}</h2>
          </div>

          {fetchDebug && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'linear-gradient(90deg, rgba(245,158,11,0.06), rgba(244,114,182,0.03))', border: '1px solid rgba(245,158,11,0.08)', color: '#F59E0B' }}>
                <strong>{t('shop.usingSampleData')}</strong> — {t('shop.cannotLoadShopData')}. {t('shop.detailsDev')} <span style={{ color: 'var(--color-muted)' }}>{fetchDebug}</span>
              </div>
            </div>
          )}

          {loading && <div style={{ color: 'var(--color-muted)', marginTop: 12 }}>{t('common.loading')}</div>}
          {error && <div style={{ color: '#F97373', marginTop: 12 }}>{error}</div>}

          {/* Skill Packages Section - chỉ hiển thị khi chọn tab Package */}
          {collectionFilter === 'package' && (
            <SkillPackageSection profile={profile} onPurchaseComplete={refreshUserState} />
          )}

          {/* Empty state khi không có sản phẩm - không hiển thị khi đang ở tab package */}
          {!loading && !error && collectionFilter !== 'package' && Object.keys(itemsByCategory).length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '60px 20px',
              color: 'rgba(255,255,255,0.6)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
              <div style={{ fontSize: 18, marginBottom: 8, color: 'rgba(255,255,255,0.8)' }}>
                {t('shop.noProducts')}
              </div>
              <div style={{ fontSize: 14 }}>
                {t('shop.noProductsHint')}
              </div>
            </div>
          )}

          {/* Dynamic sections: auto-generate from itemsByCategory - ẩn khi ở tab package */}
          {collectionFilter !== 'package' && Object.entries(itemsByCategory).map(([categoryId, items]) => {
            if (!items || items.length === 0) return null
            
            // Sort items based on globalSort
            const sortedItems = items.slice()
            if (globalSort === 'price_asc') sortedItems.sort((a, b) => a.price - b.price)
            if (globalSort === 'price_desc') sortedItems.sort((a, b) => b.price - a.price)
            
            // Get category info from categories array
            const categoryInfo = categories.find(c => c.id === categoryId)
            const categoryDisplay = categoryInfo ? `${categoryInfo.icon || ''} ${getCategoryName(categoryInfo.id, t)}` : getCategoryName(categoryId, t)
            const categoryColor = categoryInfo?.color || '#22D3EE'
            
            // Chỉ hiển thị thanh trượt ngang khi số sản phẩm > 8
            const showScroll = sortedItems.length > 8
            
            return (
              <section key={categoryId} style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ 
                    margin: '6px 0 12px 0',
                    color: categoryColor,
                    textShadow: `0 0 20px ${categoryColor}40`
                  }}>{categoryDisplay}</h3>
                </div>
                <div className={showScroll ? 'shop-grid shop-grid-scroll' : 'shop-grid'}>
                  {sortedItems.map((item, index) => (
                    <Card 
                      key={item.id} 
                      item={item} 
                      onBuy={handleBuy} 
                      owned={Boolean(ownedIds[item.id])} 
                      buying={Boolean(purchasing[item.id])} 
                      profile={profile} 
                      openInfo={openInfo} 
                      openConfirm={openConfirm}
                      dataTour={
                        // Match free items: first free item in skin_piece = free-chess, first free in skin_board = free-board
                        (item.price === 0 && categoryId === 'skin_piece' && index === sortedItems.findIndex(i => i.price === 0)) ? 'free-chess' : 
                        (item.price === 0 && categoryId === 'skin_board' && index === sortedItems.findIndex(i => i.price === 0)) ? 'free-board' : 
                        (item.id === 'skin1' || item.item_code === 'skin1') ? 'free-chess' : 
                        (item.id === 'board1' || item.item_code === 'board1') ? 'free-board' : 
                        undefined
                      }
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </main>
      </div>

      {/* Global modal rendered at Shop level to avoid stacking/context issues with card previews */}
      {modalOpen && (
        <div className="mp-modal-overlay">
          <div className="mp-modal" data-tour="shop-confirm-modal">
            {modalTitle && <div className="mp-modal-title">{modalTitle}</div>}
            <div className="mp-modal-message">{modalMessage}</div>
            <div className="mp-modal-actions">
              {modalMode === 'confirm' ? (
                <>
                  <button className="mp-btn mp-btn-secondary" onClick={() => closeModal(false)}>{t('common.cancel')}</button>
                  <button className="mp-btn mp-btn-primary" data-tour="shop-confirm-btn" onClick={() => closeModal(true)}>{t('common.confirm')}</button>
                </>
              ) : (
                <button className="mp-btn mp-btn-primary" data-tour="shop-success-btn" onClick={() => closeModal(true)}>{t('common.ok')}</button>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Filter Button */}
      <button 
        className="shop-filter-toggle-mobile"
        onClick={openFilterPopup}
        aria-label={t('shop.filterTitle')}
      >
        <span>⚙️</span>
        {activeFilterCount > 0 && (
          <span className="filter-badge">{activeFilterCount}</span>
        )}
      </button>
      
      {/* Mobile Filter Popup */}
      <div 
        className={`shop-filter-popup-overlay ${filterPopupOpen ? 'open' : ''}`}
        onClick={() => setFilterPopupOpen(false)}
      >
        <div 
          className="shop-filter-popup"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shop-filter-popup-header">
            <h3>{t('shop.filterTitle')}</h3>
            <button 
              className="shop-filter-popup-close"
              onClick={() => setFilterPopupOpen(false)}
            >
              ✕
            </button>
          </div>
          
          <div className="shop-filter-popup-content">
            {/* Search */}
            <div>
              <label>{t('shop.searchPlaceholder')}</label>
              <input 
                type="search"
                placeholder={t('shop.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            
            {/* Type filter */}
            <div>
              <label>{t('shop.filterType')}</label>
              <select value={tempType} onChange={(e) => setTempType(e.target.value)}>
                <option value="all">{capitalize(t('shop.typeAll'))}</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon} {getCategoryName(cat.id, t)}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Rarity filter */}
            <div>
              <label>{t('shop.filterRarity')}</label>
              <select value={tempRarity} onChange={(e) => setTempRarity(e.target.value)}>
                <option value="all">{t('common.all')}</option>
                <option value="common">{t('shop.rarityCommon')}</option>
                <option value="rare">{t('shop.rarityRare')}</option>
                <option value="legendary">{t('shop.rarityLegendary')}</option>
              </select>
            </div>
            
            {/* Currency filter */}
            <div>
              <label>{t('shop.filterPrice')}</label>
              <select value={tempPriceCurrency} onChange={(e) => setTempPriceCurrency(e.target.value)}>
                <option value="all">{t('common.all')}</option>
                <option value="coin">{t('shop.coins')}</option>
                <option value="gem">{t('shop.gems')}</option>
              </select>
            </div>
            
            {/* Sort */}
            <div>
              <label>{t('shop.sortLabel')}</label>
              <select value={tempGlobalSort} onChange={(e) => setTempGlobalSort(e.target.value as any)}>
                <option value="none">{t('shop.sortDefault')}</option>
                <option value="price_asc">{t('shop.sortPriceAsc')}</option>
                <option value="price_desc">{t('shop.sortPriceDesc')}</option>
              </select>
            </div>
          </div>
          
          <div className="shop-filter-popup-actions">
            <button className="shop-filter-reset" onClick={resetFilters}>
              {t('common.reset')}
            </button>
            <button className="shop-filter-apply" onClick={applyFilters}>
              {t('common.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
