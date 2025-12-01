import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../contexts/LanguageContext'

type Item = { 
  id: string
  title: string
  subtitle?: string
  media_url?: string
  rarity?: string
  type?: string
  is_equipped?: boolean
  acquired_at?: string
}

type Category = {
  id: string
  name_vi: string
  name_en?: string
  icon?: string
  color?: string
  sort_order: number
}

function Card({ 
  item, 
  onUse, 
  using 
}: { 
  item: Item
  onUse: (it: Item) => Promise<{ ok: boolean; message?: string }>
  using?: boolean
}) {
  const [hover, setHover] = React.useState(false)
  const [pos, setPos] = React.useState<{ left: number; top: number; width: number; height: number }>({ 
    left: 0, 
    top: 0, 
    width: 340, 
    height: 210 
  })
  const previewW = 340
  const previewH = 210
  const isVideo = item.media_url && item.media_url.endsWith('.mp4')

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
        {item.media_url ? '' : 'Preview'}
      </div>
      <div className="shop-card-body">
        <div className="shop-card-title">{item.title}</div>
        <div className="shop-card-sub">{item.subtitle}</div>
        {item.acquired_at && (
          <div className="acquired-date">
            Nhận: {new Date(item.acquired_at).toLocaleDateString('vi-VN')}
          </div>
        )}
        <div className="shop-card-footer">
          <div className="shop-card-price"></div>
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
            {item.is_equipped ? '✓ Đang dùng' : 'Sử dụng'}
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
          <div className="shop-card-preview-fallback">No preview</div>
        )}
      </div>
    </div>
  )
}

export default function Inventory() {
  const { t } = useLanguage()
  
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

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState<string | null>(null)
  const [modalMessage, setModalMessage] = useState<string | null>(null)
  const modalResolveRef = React.useRef<((val: boolean) => void) | null>(null)

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

  // Load categories from DB
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
              name,
              description,
              category,
              rarity,
              preview_url
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
                title: i.name || 'Unknown Item',
                subtitle: i.description || '',
                media_url: i.preview_url || '',
                rarity: i.rarity || 'common',
                type: i.category || 'other',
                is_equipped: ui.is_equipped || false,
                acquired_at: ui.acquired_at
              }
            })

          // Fix duplicate equipped items of same type
          const categoryMap = new Map<string, string[]>()
          mapped.forEach((item: Item) => {
            if (item.is_equipped) {
              const cat = item.type || 'other'
              if (!categoryMap.has(cat)) categoryMap.set(cat, [])
              categoryMap.get(cat)!.push(item.id)
            }
          })

          // If multiple items of same category are equipped, unequip all except the first one
          for (const [category, itemIds] of categoryMap.entries()) {
            if (itemIds.length > 1) {
              const toUnequip = itemIds.slice(1)
              const { error: unequipErr } = await supabase
                .from('user_items')
                .update({ is_equipped: false })
                .eq('user_id', u.id)
                .in('item_id', toUnequip)
              
              if (unequipErr) {
                console.warn('Failed to unequip duplicate items:', unequipErr)
              } else {
                // Update local state
                mapped.forEach((item: Item) => {
                  if (toUnequip.includes(item.id)) {
                    item.is_equipped = false
                  }
                })
              }
            }
          }

          // Apply filters
          let filtered = mapped
          if (type !== 'all') {
            filtered = filtered.filter((it: Item) => it.type === type)
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
            filtered = filtered.filter((it: Item) => 
              it.title.toLowerCase().includes(q) || 
              it.subtitle?.toLowerCase().includes(q)
            )
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
  }, [query, type, rarity, equipped])

  async function handleUse(item: Item) {
    const id = item.id
    setUsing(prev => ({ ...prev, [id]: true }))
    try {
      if (!user) {
        await openInfo('Lỗi', 'Vui lòng đăng nhập')
        return { ok: false }
      }

      if (item.is_equipped) {
        await openInfo('Thông báo', 'Vật phẩm này đang được sử dụng')
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

      await openInfo('Thành công', `Đã trang bị "${item.title}"`)
      return { ok: true }
    } catch (err: any) {
      console.error('Use item failed', err)
      await openInfo('Lỗi', err?.message || 'Không thể sử dụng vật phẩm')
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
              Bộ Sưu Tập
            </h2>
            <p style={{ 
              fontSize: 13, 
              color: 'rgba(255,255,255,0.6)',
              lineHeight: 1.4
            }}>
              Quản lý và sử dụng các vật phẩm đã sở hữu
            </p>
          </div>

          <div style={{ marginTop: 12 }}>
            <input 
              className="sidebar-search" 
              placeholder="Tìm kiếm..." 
              value={query} 
              onChange={e => setQuery(e.target.value)} 
            />
          </div>

          <div className="shop-filters" style={{ marginTop: 12 }}>
            <label className="filter-label">Loại vật phẩm</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="all">Tất cả</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name_vi}
                </option>
              ))}
            </select>

            <label className="filter-label">Độ hiếm</label>
            <select value={rarity} onChange={e => setRarity(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="common">Thường</option>
              <option value="rare">Hiếm</option>
              <option value="epic">Cao cấp</option>
              <option value="legendary">Huyền thoại</option>
            </select>

            <label className="filter-label">Trạng thái</label>
            <select value={equipped} onChange={e => setEquipped(e.target.value)}>
              <option value="all">Tất cả</option>
              <option value="equipped">Đang dùng</option>
              <option value="not_equipped">Chưa dùng</option>
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
              Tổng vật phẩm: <strong>{items.length}</strong>
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
              Home
            </a>
            <span style={{ color: 'var(--color-muted)' }}>›</span>
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>Inventory</span>
          </nav>

          <h2 className="section-title">Bộ sưu tập của bạn</h2>

          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.6)' }}>
              Đang tải...
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
              <div style={{ fontSize: 18, marginBottom: 8 }}>Vui lòng đăng nhập</div>
              <div style={{ fontSize: 14 }}>để xem bộ sưu tập của bạn</div>
            </div>
          )}

          {!loading && user && items.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: 60,
              color: 'rgba(255,255,255,0.6)'
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <div style={{ fontSize: 18, marginBottom: 8 }}>Chưa có vật phẩm nào</div>
              <div style={{ fontSize: 14 }}>Hãy ghé Shop để sắm đồ nhé!</div>
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
                Đi tới Shop
              </button>
            </div>
          )}

          {!loading && user && Object.entries(itemsByCategory).map(([categoryId, categoryItems]) => {
            if (categoryItems.length === 0) return null
            
            const categoryInfo = categories.find(c => c.id === categoryId)
            const displayName = categoryInfo ? `${categoryInfo.icon || ''} ${categoryInfo.name_vi}` : categoryId
            const color = categoryInfo?.color || '#22D3EE'
            
            return (
              <div key={categoryId}>
                <h3 style={{ 
                  fontSize: 20, 
                  fontWeight: 700, 
                  marginTop: 24, 
                  marginBottom: 16,
                  color: color,
                  textShadow: `0 0 20px ${color}40`
                }}>{displayName} ({categoryItems.length})</h3>
                <div className="shop-grid shop-grid-scroll">
                  {categoryItems.map(item => (
                    <Card key={item.id} item={item} onUse={handleUse} using={using[item.id]} />
                  ))}
                </div>
              </div>
            )
          })}
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
              {modalTitle === 'Thành công' ? '✨' : modalTitle === 'Lỗi' ? '⚠️' : 'ℹ️'}
            </div>
            <h3 className="mp-modal-title" style={{
              color: modalTitle === 'Thành công' ? '#22D3EE' : modalTitle === 'Lỗi' ? '#EF4444' : '#FCD34D',
              fontSize: 24,
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: 16,
              textShadow: `0 0 20px ${modalTitle === 'Thành công' ? 'rgba(34, 211, 238, 0.5)' : modalTitle === 'Lỗi' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(252, 211, 77, 0.5)'}`,
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
              <button 
                className="mp-btn mp-btn-primary" 
                onClick={() => closeModal()}
                style={{
                  width: '100%',
                  padding: '14px 24px',
                  background: 'linear-gradient(135deg, #22D3EE, #3B82F6)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#FFF',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(34, 211, 238, 0.3)',
                  transition: 'all 0.2s ease'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
