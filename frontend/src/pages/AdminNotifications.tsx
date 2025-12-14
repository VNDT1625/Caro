import React, { useState, useEffect } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import * as notificationApi from '../lib/notificationApi'
import UserSelectModal from '../components/notification/UserSelectModal'
import NotificationDetailModal from '../components/notification/NotificationDetailModal'
import { supabase } from '../lib/supabase'

// Hook to detect mobile screen
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

interface SentNotification {
  id: string
  title: string
  content: string
  content_preview: string
  is_broadcast: boolean
  created_at: string
  stats: {
    total_recipients: number
    read_count: number
    unread_count: number
  }
  gift_data?: {
    coins: number
    gems: number
    item_ids?: string[]
  } | null
  gift_stats?: {
    total_recipients: number
    claimed_count: number
    unclaimed_count: number
  }
}

const STATUS_COLORS = {
  broadcast: { bg: 'rgba(168, 85, 247, 0.15)', text: '#A855F7', border: 'rgba(168, 85, 247, 0.3)' },
  targeted: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' },
  read: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22C55E', border: 'rgba(34, 197, 94, 0.3)' },
  unread: { bg: 'rgba(251, 191, 36, 0.15)', text: '#FBBF24', border: 'rgba(251, 191, 36, 0.3)' },
}

const AdminNotifications: React.FC = () => {
  const { t } = useLanguage()
  
  // Form state
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isBroadcast, setIsBroadcast] = useState(true)
  const [selectedUsers, setSelectedUsers] = useState<{ id: string; username: string }[]>([])
  const [showUserSelect, setShowUserSelect] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)
  
  // Gift state
  const [includeGift, setIncludeGift] = useState(false)
  const [giftCoins, setGiftCoins] = useState(0)
  const [giftGems, setGiftGems] = useState(0)
  const [selectedItems, setSelectedItems] = useState<{ id: string; name: string; category: string }[]>([])
  const [showItemSelect, setShowItemSelect] = useState(false)
  const [availableItems, setAvailableItems] = useState<{ id: string; name: string; category: string; rarity: string }[]>([])
  const [itemSearchQuery, setItemSearchQuery] = useState('')

  // Sent notifications
  const [sentNotifications, setSentNotifications] = useState<SentNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const perPage = 10

  // Detail modal
  const [selectedNotification, setSelectedNotification] = useState<SentNotification | null>(null)

  // Filter
  const [filterType, setFilterType] = useState<'all' | 'broadcast' | 'targeted'>('all')

  useEffect(() => {
    fetchSentNotifications()
  }, [page, filterType])

  // Fetch available items for gift selection
  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from('items')
        .select('id, name, category, rarity')
        .eq('is_available', true)
        .order('category')
        .order('name')
      
      if (!error && data) {
        setAvailableItems(data)
      }
    }
    fetchItems()
  }, [])

  const fetchSentNotifications = async () => {
    setLoading(true)
    try {
      const result = await notificationApi.getSentNotifications(page, perPage)
      if (result.success) {
        let filtered = result.notifications
        if (filterType === 'broadcast') {
          filtered = filtered.filter((n: SentNotification) => n.is_broadcast)
        } else if (filterType === 'targeted') {
          filtered = filtered.filter((n: SentNotification) => !n.is_broadcast)
        }
        setSentNotifications(filtered)
        setTotalPages(result.pagination.total_pages)
        setTotal(result.pagination.total)
      }
    } catch (err) {
      console.error('Failed to fetch sent notifications:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    setSendError(null)
    setSendSuccess(false)

    if (!title.trim() || !content.trim()) {
      setSendError('Vui lòng nhập tiêu đề và nội dung')
      return
    }

    if (!isBroadcast && selectedUsers.length === 0) {
      setSendError('Vui lòng chọn người nhận')
      return
    }

    // Validate gift if included
    if (includeGift && giftCoins === 0 && giftGems === 0 && selectedItems.length === 0) {
      setSendError('Vui lòng nhập số lượng quà (Tinh Thạch, Nguyên Thần hoặc vật phẩm)')
      return
    }

    setSending(true)
    try {
      const giftData = includeGift ? {
        coins: giftCoins,
        gems: giftGems,
        item_ids: selectedItems.map(i => i.id)
      } : null

      const result = await notificationApi.sendNotification(
        title,
        content,
        selectedUsers.map(u => u.id),
        isBroadcast,
        giftData
      )

      if (result.success) {
        setSendSuccess(true)
        setTitle('')
        setContent('')
        setSelectedUsers([])
        setIncludeGift(false)
        setGiftCoins(0)
        setGiftGems(0)
        setSelectedItems([])
        setShowItemSelect(false)
        fetchSentNotifications()
        setTimeout(() => setSendSuccess(false), 3000)
      } else {
        setSendError(result.error || 'Gửi thông báo thất bại')
      }
    } catch (err) {
      setSendError('Lỗi khi gửi thông báo')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa thông báo này? Tất cả người dùng sẽ không còn thấy thông báo.')) {
      return
    }

    try {
      const result = await notificationApi.adminDeleteNotification(id)
      if (result.success) {
        fetchSentNotifications()
      }
    } catch (err) {
      console.error('Failed to delete notification:', err)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN')
  }

  const getReadRate = (stats: SentNotification['stats']) => {
    if (stats.total_recipients === 0) return 0
    return Math.round((stats.read_count / stats.total_recipients) * 100)
  }

  // Stats
  const broadcastCount = sentNotifications.filter(n => n.is_broadcast).length
  const targetedCount = sentNotifications.filter(n => !n.is_broadcast).length

  return (
    <div style={{ padding: '20px' }} className="admin-notifications-page">
      {/* Mobile Breadcrumb - Simple inline */}
      {useIsMobile() && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span 
            style={{ fontSize: 13, color: '#94A3B8', cursor: 'pointer' }}
            onClick={() => window.location.hash = '#admin'}
          >
            {t('breadcrumb.admin') || 'Admin'}
          </span>
          <span style={{ color: '#94A3B8' }}>›</span>
          <span style={{ fontSize: 13, color: '#E2E8F0', fontWeight: 500 }}>
            {t('breadcrumb.notifications') || 'Thông báo'}
          </span>
        </div>
      )}
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <button
            onClick={() => window.history.back()}
            className="desktop-breadcrumb"
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(71, 85, 105, 0.3)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#94A3B8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Quay lại
          </button>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>
            🔔 Gửi Thông Báo Hệ Thống
          </h2>
        </div>
        <p style={{ margin: '8px 0 0', color: '#94A3B8', fontSize: '14px' }}>
          Gửi thông báo đến tất cả người dùng hoặc chọn người nhận cụ thể
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
        {/* Send Form */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          borderRadius: '12px',
          border: '1px solid rgba(71, 85, 105, 0.3)',
          padding: '20px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: 600, color: '#F8FAFC' }}>
            ✉️ Tạo Thông Báo Mới
          </h3>

          <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Title */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                Tiêu đề
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề thông báo..."
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  color: '#F8FAFC',
                  fontSize: '14px',
                }}
              />
            </div>

            {/* Content */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                Nội dung
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Nhập nội dung thông báo..."
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(71, 85, 105, 0.4)',
                  color: '#F8FAFC',
                  fontSize: '14px',
                  resize: 'vertical',
                  minHeight: '100px',
                }}
              />
            </div>

            {/* Recipient Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 500 }}>
                Người nhận
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: isBroadcast ? 'rgba(168, 85, 247, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                  border: `1px solid ${isBroadcast ? 'rgba(168, 85, 247, 0.4)' : 'rgba(71, 85, 105, 0.3)'}`,
                  cursor: 'pointer',
                  flex: 1,
                }}>
                  <input
                    type="radio"
                    checked={isBroadcast}
                    onChange={() => setIsBroadcast(true)}
                    style={{ accentColor: '#A855F7' }}
                  />
                  <span style={{ color: isBroadcast ? '#A855F7' : '#94A3B8', fontSize: '13px' }}>
                    📢 Tất cả
                  </span>
                </label>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: !isBroadcast ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                  border: `1px solid ${!isBroadcast ? 'rgba(56, 189, 248, 0.4)' : 'rgba(71, 85, 105, 0.3)'}`,
                  cursor: 'pointer',
                  flex: 1,
                }}>
                  <input
                    type="radio"
                    checked={!isBroadcast}
                    onChange={() => setIsBroadcast(false)}
                    style={{ accentColor: '#38BDF8' }}
                  />
                  <span style={{ color: !isBroadcast ? '#38BDF8' : '#94A3B8', fontSize: '13px' }}>
                    👤 Chọn người
                  </span>
                </label>
              </div>
            </div>

            {/* Selected Users */}
            {!isBroadcast && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowUserSelect(true)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38BDF8',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  + Chọn người nhận ({selectedUsers.length} đã chọn)
                </button>
                {selectedUsers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selectedUsers.map(user => (
                      <span
                        key={user.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'rgba(56, 189, 248, 0.2)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#38BDF8',
                          fontSize: '12px',
                        }}
                      >
                        {user.username}
                        <button
                          type="button"
                          onClick={() => setSelectedUsers(prev => prev.filter(u => u.id !== user.id))}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#EF4444',
                            cursor: 'pointer',
                            padding: 0,
                            fontSize: '14px',
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Gift Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}>
                <input
                  type="checkbox"
                  checked={includeGift}
                  onChange={(e) => setIncludeGift(e.target.checked)}
                  style={{ accentColor: '#F59E0B', width: '16px', height: '16px' }}
                />
                <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 500 }}>
                  🎁 Gửi kèm quà tặng
                </span>
              </label>

              {includeGift && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#F59E0B', display: 'block', marginBottom: '4px' }}>
                        💎 Tinh Thạch (Coins)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100000"
                        value={giftCoins}
                        onChange={(e) => setGiftCoins(Math.max(0, Math.min(100000, parseInt(e.target.value) || 0)))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(71, 85, 105, 0.4)',
                          color: '#F8FAFC',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '12px', color: '#A855F7', display: 'block', marginBottom: '4px' }}>
                        ✨ Nguyên Thần (Gems)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={giftGems}
                        onChange={(e) => setGiftGems(Math.max(0, Math.min(10000, parseInt(e.target.value) || 0)))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: '6px',
                          background: 'rgba(30, 41, 59, 0.8)',
                          border: '1px solid rgba(71, 85, 105, 0.4)',
                          color: '#F8FAFC',
                          fontSize: '14px',
                        }}
                      />
                    </div>
                  </div>
                  {/* Item Selection */}
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#22D3EE', display: 'block', marginBottom: '4px' }}>
                      🎁 Vật phẩm
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowItemSelect(!showItemSelect)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(34, 211, 238, 0.3)',
                        color: '#22D3EE',
                        fontSize: '13px',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      + Chọn vật phẩm ({selectedItems.length} đã chọn)
                    </button>
                    
                    {/* Selected Items Display */}
                    {selectedItems.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {selectedItems.map(item => (
                          <span
                            key={item.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              background: 'rgba(34, 211, 238, 0.2)',
                              border: '1px solid rgba(34, 211, 238, 0.3)',
                              color: '#22D3EE',
                              fontSize: '11px',
                            }}
                          >
                            {item.name}
                            <button
                              type="button"
                              onClick={() => setSelectedItems(prev => prev.filter(i => i.id !== item.id))}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#EF4444',
                                cursor: 'pointer',
                                padding: 0,
                                fontSize: '12px',
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Item Selection Dropdown */}
                    {showItemSelect && (
                      <div style={{
                        marginTop: '6px',
                        padding: '8px',
                        borderRadius: '6px',
                        background: 'rgba(15, 23, 42, 0.9)',
                        border: '1px solid rgba(71, 85, 105, 0.4)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}>
                        <input
                          type="text"
                          placeholder="Tìm vật phẩm..."
                          value={itemSearchQuery}
                          onChange={(e) => setItemSearchQuery(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '4px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(71, 85, 105, 0.4)',
                            color: '#F8FAFC',
                            fontSize: '12px',
                            marginBottom: '6px',
                          }}
                        />
                        {availableItems
                          .filter(item => 
                            item.name.toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
                            item.category?.toLowerCase().includes(itemSearchQuery.toLowerCase())
                          )
                          .slice(0, 20)
                          .map(item => {
                            const isSelected = selectedItems.some(i => i.id === item.id)
                            const rarityColors: Record<string, string> = {
                              common: '#94A3B8',
                              rare: '#3B82F6',
                              epic: '#A855F7',
                              legendary: '#F59E0B',
                            }
                            return (
                              <div
                                key={item.id}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedItems(prev => prev.filter(i => i.id !== item.id))
                                  } else {
                                    setSelectedItems(prev => [...prev, { id: item.id, name: item.name, category: item.category }])
                                  }
                                }}
                                style={{
                                  padding: '6px 8px',
                                  borderRadius: '4px',
                                  background: isSelected ? 'rgba(34, 211, 238, 0.2)' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  fontSize: '12px',
                                }}
                              >
                                <span style={{ color: isSelected ? '#22D3EE' : '#F8FAFC' }}>
                                  {isSelected && '✓ '}{item.name}
                                </span>
                                <span style={{ 
                                  color: rarityColors[item.rarity] || '#94A3B8',
                                  fontSize: '10px',
                                  textTransform: 'capitalize',
                                }}>
                                  {item.rarity}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>
                    Người nhận sẽ nhận được quà khi mở thông báo và bấm "Nhận quà"
                  </div>
                </div>
              )}
            </div>

            {/* Error/Success */}
            {sendError && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: '13px',
              }}>
                {sendError}
              </div>
            )}
            {sendSuccess && (
              <div style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22C55E',
                fontSize: '13px',
              }}>
                ✓ Gửi thông báo thành công!
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={sending}
              style={{
                padding: '12px 20px',
                borderRadius: '8px',
                background: sending
                  ? 'rgba(71, 85, 105, 0.4)'
                  : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                border: 'none',
                color: '#FFFFFF',
                fontSize: '14px',
                fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer',
              }}
            >
              {sending ? '⏳ Đang gửi...' : '📤 Gửi Thông Báo'}
            </button>
          </form>
        </div>

        {/* Sent Notifications */}
        <div>
          {/* Stats Summary */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div
              onClick={() => setFilterType('all')}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: filterType === 'all' ? 'rgba(71, 85, 105, 0.4)' : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${filterType === 'all' ? 'rgba(148, 163, 184, 0.4)' : 'rgba(71, 85, 105, 0.3)'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>{total}</div>
              <div style={{ fontSize: '12px', color: '#94A3B8' }}>Tổng thông báo</div>
            </div>
            <div
              onClick={() => setFilterType('broadcast')}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: filterType === 'broadcast' ? STATUS_COLORS.broadcast.bg : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${filterType === 'broadcast' ? STATUS_COLORS.broadcast.border : 'rgba(71, 85, 105, 0.3)'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: STATUS_COLORS.broadcast.text }}>{broadcastCount}</div>
              <div style={{ fontSize: '12px', color: STATUS_COLORS.broadcast.text }}>📢 Broadcast</div>
            </div>
            <div
              onClick={() => setFilterType('targeted')}
              style={{
                padding: '14px 16px',
                borderRadius: '10px',
                background: filterType === 'targeted' ? STATUS_COLORS.targeted.bg : 'rgba(15, 23, 42, 0.6)',
                border: `1px solid ${filterType === 'targeted' ? STATUS_COLORS.targeted.border : 'rgba(71, 85, 105, 0.3)'}`,
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: '24px', fontWeight: 700, color: STATUS_COLORS.targeted.text }}>{targetedCount}</div>
              <div style={{ fontSize: '12px', color: STATUS_COLORS.targeted.text }}>👤 Targeted</div>
            </div>
          </div>

          {/* Table */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px solid rgba(71, 85, 105, 0.3)',
            overflow: 'hidden',
          }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 80px 120px 100px 80px',
              gap: '12px',
              padding: '14px 16px',
              background: 'rgba(30, 41, 59, 0.8)',
              fontWeight: 600,
              fontSize: '13px',
              color: '#CBD5E1',
              borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
            }}>
              <div>Thông báo</div>
              <div>Loại</div>
              <div>Quà</div>
              <div>Tỷ lệ đọc</div>
              <div>Ngày gửi</div>
              <div>Thao tác</div>
            </div>

            {/* Loading State */}
            {loading && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                Đang tải...
              </div>
            )}

            {/* Empty State */}
            {!loading && sentNotifications.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                Chưa có thông báo nào được gửi
              </div>
            )}

            {/* Table Rows */}
            {!loading && sentNotifications.map((notification, index) => {
              const readRate = getReadRate(notification.stats)
              const typeColors = notification.is_broadcast ? STATUS_COLORS.broadcast : STATUS_COLORS.targeted
              const hasGift = notification.gift_data && (notification.gift_data.coins > 0 || notification.gift_data.gems > 0 || (notification.gift_data.item_ids?.length || 0) > 0)
              const giftClaimRate = notification.gift_stats 
                ? (notification.gift_stats.total_recipients > 0 
                    ? Math.round((notification.gift_stats.claimed_count / notification.gift_stats.total_recipients) * 100) 
                    : 0)
                : 0

              return (
                <div
                  key={notification.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 80px 120px 100px 80px',
                    gap: '12px',
                    padding: '14px 16px',
                    background: index % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)',
                    borderBottom: '1px solid rgba(71, 85, 105, 0.2)',
                    alignItems: 'center',
                    fontSize: '14px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: '#F8FAFC', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {notification.title}
                      {hasGift && <span title="Có quà tặng">🎁</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {notification.content_preview}
                    </div>
                  </div>
                  <div>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: typeColors.bg,
                      border: `1px solid ${typeColors.border}`,
                      color: typeColors.text,
                      fontSize: '11px',
                      fontWeight: 500,
                    }}>
                      {notification.is_broadcast ? '📢 All' : '👤 Target'}
                    </span>
                  </div>
                  <div>
                    {hasGift ? (
                      <div style={{ fontSize: '11px' }}>
                        {notification.gift_data!.coins > 0 && (
                          <div style={{ color: '#F59E0B' }}>💎 {notification.gift_data!.coins}</div>
                        )}
                        {notification.gift_data!.gems > 0 && (
                          <div style={{ color: '#A855F7' }}>✨ {notification.gift_data!.gems}</div>
                        )}
                        {(notification.gift_data!.item_ids?.length || 0) > 0 && (
                          <div style={{ color: '#22D3EE' }}>🎁 {notification.gift_data!.item_ids!.length} items</div>
                        )}
                        <div style={{ color: '#64748B', marginTop: '2px' }}>
                          {giftClaimRate}% nhận
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#64748B', fontSize: '12px' }}>—</span>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        flex: 1,
                        height: '6px',
                        borderRadius: '3px',
                        background: 'rgba(71, 85, 105, 0.4)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${readRate}%`,
                          height: '100%',
                          background: readRate > 50 ? '#22C55E' : '#FBBF24',
                          borderRadius: '3px',
                        }} />
                      </div>
                      <span style={{ fontSize: '12px', color: '#94A3B8', minWidth: '40px' }}>
                        {readRate}%
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                      {notification.stats.read_count}/{notification.stats.total_recipients}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                    {formatDate(notification.created_at).split(',')[0]}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setSelectedNotification(notification)}
                      title="Xem chi tiết"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.3)',
                        color: '#38BDF8',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      👁
                    </button>
                    <button
                      onClick={() => handleDelete(notification.id)}
                      title="Xóa"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#EF4444',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '16px',
              padding: '12px 16px',
              background: 'rgba(15, 23, 42, 0.6)',
              borderRadius: '10px',
            }}>
              <div style={{ color: '#94A3B8', fontSize: '14px' }}>
                Trang {page} / {totalPages}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: page === 1 ? 'rgba(71, 85, 105, 0.2)' : 'rgba(71, 85, 105, 0.4)',
                    border: 'none',
                    color: page === 1 ? '#64748B' : '#F8FAFC',
                    cursor: page === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ← Trước
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: page === totalPages ? 'rgba(71, 85, 105, 0.2)' : 'rgba(71, 85, 105, 0.4)',
                    border: 'none',
                    color: page === totalPages ? '#64748B' : '#F8FAFC',
                    cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Select Modal */}
      {showUserSelect && (
        <UserSelectModal
          selectedUsers={selectedUsers}
          onSelect={setSelectedUsers}
          onClose={() => setShowUserSelect(false)}
        />
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          notification={selectedNotification}
          onClose={() => setSelectedNotification(null)}
        />
      )}
    </div>
  )
}

export default AdminNotifications
