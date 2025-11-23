import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

type Item = { id: string; title: string; subtitle?: string; price: number; currency?: 'coin' | 'gem'; media_url?: string; rarity?: string; type?: string }

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

const sampleSkins: Item[] = [
  { id: 'skin1', title: 'Quân Cờ Gỗ Cổ Điển', subtitle: 'Classic wood', price: 0, currency: 'coin', media_url: '' },
  { id: 'skin2', title: 'Quân Cờ Ngọc Bích', subtitle: 'Jade pieces', price: 250, currency: 'coin', media_url: '' },
  { id: 'skin3', title: 'Quân Cờ Hoàng Kim', subtitle: 'Gold pieces', price: 50, currency: 'gem', media_url: '' }
]

const sampleBoards: Item[] = [
  { id: 'board1', title: 'Bàn Cờ Cổ Điển', subtitle: 'Wooden board', price: 0, currency: 'coin', media_url: '' },
  { id: 'board2', title: 'Bàn Cờ Hoa Anh Đào', subtitle: 'Sakura board', price: 600, currency: 'coin', media_url: '' },
  { id: 'board3', title: 'Bàn Cờ Vũ Trụ', subtitle: 'Space board', price: 120, currency: 'gem', media_url: '' }
]

function Card({ item, onBuy, owned, buying, profile, openInfo, openConfirm }: { item: Item; onBuy: (it: Item)=>Promise<{ok: boolean; message?: string}> | Promise<any>; owned?: boolean; buying?: boolean; profile?: any; openInfo: (title: string, msg: string)=>Promise<void>; openConfirm: (title: string, msg: string)=>Promise<boolean> }) {
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
      case 'common': return 'Thường'
      case 'rare': return 'Hiếm'
      case 'epic': return 'Cao cấp'
      case 'legendary': return 'Huyền thoại'
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
    <div className={`shop-card ${clickedDbg ? 'debug-clicked' : ''}`} onClick={handleCardClickDebug} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onMouseMove={handleMouseMove}>
      <div className="shop-card-media">
        {item.rarity && <div className={`rarity-badge ${item.rarity ? `rarity-${item.rarity}` : ''}`}>{rarityLabel(item.rarity)}</div>}
        {item.media_url ? '' : 'Preview'}
      </div>
      <div className="shop-card-body">
        <div className="shop-card-title">{item.title}</div>
        <div className="shop-card-sub">{item.subtitle}</div>
        <div className="shop-card-footer">
          <div className="shop-card-price" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.price === 0 ? 'Miễn phí' : (
              <>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{item.price}</span>
                <img 
                  src={item.currency === 'gem' ? '/gem.png' : '/coin.png'} 
                  alt={item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'} 
                  style={{ width: 18, height: 18, objectFit: 'contain', filter: `drop-shadow(0 2px 4px ${item.currency === 'gem' ? 'rgba(34, 211, 238, 0.4)' : 'rgba(251, 191, 36, 0.4)'})` }} 
                />
              </>
            )}
          </div>
          <button
            className="shop-buy"
            style={{ pointerEvents: 'auto', opacity: (owned || buying) ? 0.6 : (canAfford ? 1 : 0.6), cursor: (owned || buying) ? 'not-allowed' : (canAfford ? 'pointer' : 'not-allowed') }}
            disabled={Boolean(buying) || Boolean(owned)}
            onClick={async (e) => {
              e.stopPropagation()
              console.log('shop-buy clicked', item.id)

              // If the item costs > 0 and we don't have a loaded profile, ask user to sign in (modal)
              if ((item.price ?? 0) > 0 && !profile) {
                await openInfo('Cần đăng nhập', 'Vui lòng đăng nhập để mua vật phẩm.')
                return
              }

              // If user can't afford, show a friendly modal and stop
              if (!(canAfford)) {
                const cur = item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'
                await openInfo('Không đủ tiền', `Không đủ ${cur} để mua vật phẩm này.`)
                return
              }

              // show a quick debug info modal to confirm the button received the click
              const debugLabel = item.price === 0 ? 'Nhận' : `Mua (${item.price} ${item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'})`
              await openInfo('Đã nhấn', `Đã nhấn: ${debugLabel}`)

              const label = item.price === 0 ? 'Nhận' : `Mua (${item.price} ${item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'})`
              const ok = await openConfirm('Xác nhận mua', `Bạn chắc chắn muốn ${label}?`)
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
                  await openInfo('Thành công', 'Mua thành công!')
                } else {
                  await openInfo('Không thành công', msg || 'Không thể mua vật phẩm.')
                }
              } catch (err: any) {
                console.error('onBuy threw', err)
                await openInfo('Lỗi', 'Lỗi khi mua: ' + (err?.message ?? String(err)))
              }
            }}
          >
            {owned ? 'Đã sở hữu' : (buying ? 'Đang xử lý...' : (item.price === 0 ? 'Nhận' : 'Mua'))}
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
          <div className="shop-card-preview-fallback">No preview</div>
        )}
        <div className="shop-card-preview-meta">
          <div className="shop-card-preview-price" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {item.price === 0 ? 'Miễn phí' : (
              <>
                <span>{item.price}</span>
                <img 
                  src={item.currency === 'gem' ? '/gem.png' : '/coin.png'} 
                  alt={item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'} 
                  style={{ width: 16, height: 16, objectFit: 'contain' }} 
                />
                <span style={{ fontSize: 11 }}>{item.currency === 'gem' ? 'Nguyên Thần' : 'Tinh Thạch'}</span>
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
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
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
          setCategories(data)
        }
      } catch (err) {
        console.warn('Failed to load categories:', err)
      }
    }
    loadCategories()
    return () => { cancelled = true }
  }, [])

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
        let qb: any = supabase.from('items').select('id,name,description,price_coins,price_gems,category,rarity,is_available,item_code,preview_url')
        if (type !== 'all') {
          // Filter by exact category match when specific type selected
          qb = qb.eq('category', type)
        }
        if (rarity !== 'all') qb = qb.eq('rarity', rarity)
        if (query && query.trim()) qb = qb.ilike('name', `%${query.trim()}%`)
        qb = qb.order ? qb.order('created_at', { ascending: false }) : qb

        const { data, error } = await qb
        if (error) throw error
        if (!cancelled && Array.isArray(data)) {
          const mapped = data.map((i: any) => {
            const priceCoins = Number(i.price_coins ?? 0)
            const priceGems = Number(i.price_gems ?? 0)
            const currency = priceGems > 0 ? 'gem' : 'coin'
            const price = priceGems > 0 ? priceGems : priceCoins
            const cat: string = (i.category || 'other').toString().trim()
            return {
              id: i.id,
              title: i.name || i.item_code || 'Item',
              subtitle: i.description || '',
              price,
              currency: currency as 'coin' | 'gem',
              media_url: i.preview_url || '',
              type: cat, // use category directly as type
              rarity: i.rarity,
            }
          })

          // apply client-side price filters (currency)
          let filtered = mapped
          if (priceCurrency !== 'all') {
            filtered = filtered.filter((it: any) => it.currency === priceCurrency)
          }

          // Group items by category dynamically
          const grouped: Record<string, Item[]> = {}
          const categories = new Set<string>()
          
          filtered.forEach((item: Item) => {
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
          skin: sampleSkins,
          board: sampleBoards
        }
        setItemsByCategory(fallbackGrouped)
        setAvailableCategories(['skin', 'board'])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchItems()
    return () => { cancelled = true }
  }, [query, type, rarity, priceCurrency])

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
      if (prof) setProfile(prof)
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
        return { ok: false, message: 'Vui lòng đăng nhập để mua hoặc nhận vật phẩm.' }
      }
      uid = u.id
      // keep local state in sync
      setUser(u)
    } catch (e) {
      console.warn('auth read err', e)
      return { ok: false, message: 'Lỗi xác thực người dùng.' }
    }
    const id = item.id
    setPurchasing(prev => ({ ...prev, [id]: true }))
    try {
      if (ownedIds[id]) {
        return { ok: false, message: 'Bạn đã sở hữu vật phẩm này.' }
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
            return { ok: false, message: 'Bạn đã sở hữu vật phẩm này.' }
          }
          throw errInsert
        }
        await refreshUserState()
        return { ok: true }
      }

      // paid item -> check profile funds (ensure profile exists)
      const prof = await ensureProfileExists(uid)
      const coins = Number(prof?.coins ?? 0)
      const gems = Number(prof?.gems ?? 0)
      if (item.currency === 'coin' && coins < item.price) {
        return { ok: false, message: 'Không đủ Tinh Thạch để mua vật phẩm này.' }
      }
      if (item.currency === 'gem' && gems < item.price) {
        return { ok: false, message: 'Không đủ Nguyên Thần để mua vật phẩm này.' }
      }

      // attempt deduct and assign (optimistic)
      if (item.currency === 'coin') {
        const newCoins = coins - item.price
        const { error: updErr } = await supabase.from('profiles').update({ coins: newCoins }).eq('user_id', uid)
        if (updErr) throw updErr
      } else if (item.currency === 'gem') {
        const newGems = gems - item.price
        const { error: updErr } = await supabase.from('profiles').update({ gems: newGems }).eq('user_id', uid)
        if (updErr) throw updErr
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
        return { ok: false, message: 'Lỗi cơ sở dữ liệu: cần một `profiles` cho user này. Chi tiết: ' + msg }
      } else if (msg && /duplicate key value|unique constraint/i.test(msg)) {
        // already owned — refresh state and inform user
        await refreshUserState()
        return { ok: true }
      } else {
        return { ok: false, message: 'Không thể mua vật phẩm: ' + msg }
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
      <div className="shop-page" style={{ gap: 18 }}>
        <aside className="panel shop-sidebar">
          {/* Category pills matching mock (All, Sale & Hot, GIFTS, Pass, Package) */}
          <div style={{ marginBottom: 8 }}>
            <div className="category-pills">
              <button className={`category-pill ${type === 'all' ? 'active' : ''}`} onClick={() => setType('all')}>All</button>
              <button className={`category-pill ${type === 'sale' ? 'active' : ''}`} onClick={() => setType('sale')}>Sale & Hot</button>
              <button className={`category-pill ${type === 'gifts' ? 'active' : ''}`} onClick={() => setType('gifts')}>Tinh Thạch & Nguyên Thần</button>
              <button className={`category-pill ${type === 'pass' ? 'active' : ''}`} onClick={() => setType('pass')}>Pass</button>
              <button className={`category-pill ${type === 'package' ? 'active' : ''}`} onClick={() => setType('package')}>Package</button>
            </div>
          </div>

          

          <div style={{ marginTop: 12 }}>
            <input className="sidebar-search" placeholder="Tìm kiếm..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          <div style={{ marginTop: 12 }} />

          <div className="shop-filters" style={{ marginTop: 12 }}>
            <label>Loại</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="all">Tất cả</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name_vi}
                </option>
              ))}
            </select>

            <label style={{ marginTop: 8 }}>Độ hiếm</label>
            <select value={rarity} onChange={e => setRarity(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="legendary">Huyền thoại</option>
            </select>

            {/* Price filter block (mock shows price filters) */}
            <label style={{ marginTop: 8 }}>Giá</label>
            <div className="price-filters">
              <select value={priceCurrency} onChange={e => setPriceCurrency(e.target.value)}>
                <option value="all">Tất cả</option>
                <option value="coin">Tinh Thạch</option>
                <option value="gem">Nguyên Thần</option>
              </select>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--color-muted)' }}>Sắp xếp</label>
                <select value={globalSort} onChange={e => setGlobalSort(e.target.value as any)} style={{ width: '100%', marginTop: 6 }}>
                  <option value="none">Mặc định</option>
                  <option value="price_asc">Giá: Tăng dần</option>
                  <option value="price_desc">Giá: Giảm dần</option>
                </select>
              </div>
              {/* slider removed per request — no numeric price bounds UI */}
            </div>
          </div>
        </aside>
        

        <main className="panel shop-main">
          {/* Breadcrumb navigation */}
          <nav style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '13px', 
            color: 'var(--color-muted)',
            marginBottom: '12px'
          }}>
            <a 
              href="#home" 
              style={{ 
                color: 'var(--color-muted)', 
                textDecoration: 'none',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-muted)'}
            >
              Chánh Điện
            </a>
            <span style={{ color: 'var(--color-muted)' }}>›</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>Tiêu Bảo Các</span>
          </nav>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>Cửa hàng</h2>
          </div>

          {fetchDebug && (
            <div style={{ marginTop: 12 }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'linear-gradient(90deg, rgba(245,158,11,0.06), rgba(244,114,182,0.03))', border: '1px solid rgba(245,158,11,0.08)', color: '#F59E0B' }}>
                <strong>Đang dùng dữ liệu mẫu</strong> — Không thể tải dữ liệu cửa hàng từ server. Chi tiết (dev): <span style={{ color: 'var(--color-muted)' }}>{fetchDebug}</span>
              </div>
            </div>
          )}

          {loading && <div style={{ color: 'var(--color-muted)', marginTop: 12 }}>Đang tải...</div>}
          {error && <div style={{ color: '#F97373', marginTop: 12 }}>{error}</div>}

          {/* Dynamic sections: auto-generate from itemsByCategory */}
          {Object.entries(itemsByCategory).map(([categoryId, items]) => {
            if (!items || items.length === 0) return null
            
            // Sort items based on globalSort
            const sortedItems = items.slice()
            if (globalSort === 'price_asc') sortedItems.sort((a, b) => a.price - b.price)
            if (globalSort === 'price_desc') sortedItems.sort((a, b) => b.price - a.price)
            
            // Get category info from categories array
            const categoryInfo = categories.find(c => c.id === categoryId)
            const categoryDisplay = categoryInfo ? `${categoryInfo.icon || ''} ${categoryInfo.name_vi}` : categoryId.charAt(0).toUpperCase() + categoryId.slice(1)
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
                  {sortedItems.map(item => (
                    <Card 
                      key={item.id} 
                      item={item} 
                      onBuy={handleBuy} 
                      owned={Boolean(ownedIds[item.id])} 
                      buying={Boolean(purchasing[item.id])} 
                      profile={profile} 
                      openInfo={openInfo} 
                      openConfirm={openConfirm} 
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
          <div className="mp-modal">
            {modalTitle && <div className="mp-modal-title">{modalTitle}</div>}
            <div className="mp-modal-message">{modalMessage}</div>
            <div className="mp-modal-actions">
              {modalMode === 'confirm' ? (
                <>
                  <button className="mp-btn mp-btn-secondary" onClick={() => closeModal(false)}>Hủy</button>
                  <button className="mp-btn mp-btn-primary" onClick={() => closeModal(true)}>Xác nhận</button>
                </>
              ) : (
                <button className="mp-btn mp-btn-primary" onClick={() => closeModal(true)}>OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
