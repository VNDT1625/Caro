import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { getNotification, claimGift } from '../../lib/notificationApi'
import { supabase } from '../../lib/supabase'

interface ItemInfo {
  id: string
  name: string
  category: string
  rarity?: string
}

interface NotificationData {
  id: string
  title: string
  content?: string
  content_preview?: string
  sender_name?: string
  is_read?: boolean
  read_at?: string | null
  created_at: string
  is_broadcast: boolean
  stats?: {
    total_recipients: number
    read_count: number
    unread_count: number
  }
  gift_data?: {
    coins: number
    gems: number
    item_ids?: string[]
  } | null
  gift_claimed?: boolean
  gift_claimed_at?: string | null
  gift_stats?: {
    total_recipients: number
    claimed_count: number
    unclaimed_count: number
  }
}

interface NotificationDetailModalProps {
  notificationId?: string
  notification?: NotificationData
  onClose: () => void
}

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  notificationId,
  notification: propNotification,
  onClose
}) => {
  const { t } = useLanguage()
  const [notification, setNotification] = useState<NotificationData | null>(propNotification || null)
  const [loading, setLoading] = useState(!propNotification)
  const [error, setError] = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)
  const [claimResult, setClaimResult] = useState<{ coins: number; gems: number; items: string[] } | null>(null)
  const [claimError, setClaimError] = useState<string | null>(null)
  const [giftItems, setGiftItems] = useState<ItemInfo[]>([])
  const [loadingItems, setLoadingItems] = useState(false)

  useEffect(() => {
    if (propNotification) {
      console.log('[NotificationDetailModal] Using propNotification:', propNotification)
      setNotification(propNotification)
      setLoading(false)
      return
    }

    if (!notificationId) return

    const fetchDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await getNotification(notificationId)
        console.log('[NotificationDetailModal] API response:', result)
        if (result.success && result.notification) {
          console.log('[NotificationDetailModal] gift_data:', result.notification.gift_data)
          setNotification(result.notification)
        } else {
          setError('Không tìm thấy thông báo')
        }
      } catch (err) {
        console.error('[NotificationDetailModal] Error:', err)
        setError('Lỗi khi tải thông báo')
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [notificationId, propNotification])

  // Fetch item names when notification has gift items
  useEffect(() => {
    const fetchItemNames = async () => {
      const itemIds = notification?.gift_data?.item_ids
      if (!itemIds || itemIds.length === 0) {
        setGiftItems([])
        return
      }
      
      setLoadingItems(true)
      try {
        const { data, error } = await supabase
          .from('items')
          .select('id, name, category, rarity')
          .in('id', itemIds)
        
        if (!error && data) {
          setGiftItems(data)
        }
      } catch (err) {
        console.error('Failed to fetch item names:', err)
      } finally {
        setLoadingItems(false)
      }
    }
    
    fetchItemNames()
  }, [notification?.gift_data?.item_ids])

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getReadRate = () => {
    if (!notification?.stats) return null
    const { total_recipients, read_count } = notification.stats
    if (total_recipients === 0) return 0
    return Math.round((read_count / total_recipients) * 100)
  }

  const hasGift = notification?.gift_data && 
    ((notification.gift_data.coins || 0) > 0 || (notification.gift_data.gems || 0) > 0 || (notification.gift_data.item_ids?.length || 0) > 0)
  
  const canClaimGift = hasGift && !notification?.gift_claimed && !claimResult

  const handleClaimGift = async () => {
    if (!notification?.id || claiming) return
    
    setClaiming(true)
    setClaimError(null)
    
    try {
      const result = await claimGift(notification.id)
      if (result.success && result.claimed) {
        setClaimResult({
          coins: result.claimed.coins,
          gems: result.claimed.gems,
          items: result.claimed.items || []
        })
        // Update local state
        setNotification(prev => prev ? { ...prev, gift_claimed: true } : null)
        
        // Dispatch event to refresh currency in header
        if (result.claimed.coins > 0 || result.claimed.gems > 0) {
          window.dispatchEvent(new CustomEvent('profileUpdated', {
            detail: { field: 'currency' }
          }))
        }
      } else {
        setClaimError(result.error || 'Không thể nhận quà')
      }
    } catch (err) {
      setClaimError('Lỗi khi nhận quà')
    } finally {
      setClaiming(false)
    }
  }

  // Helper to get rarity color
  const getRarityColor = (rarity?: string) => {
    const colors: Record<string, string> = {
      common: '#94A3B8',
      rare: '#3B82F6',
      epic: '#A855F7',
      legendary: '#F59E0B',
    }
    return colors[rarity || 'common'] || '#94A3B8'
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      background: 'rgba(0, 0, 0, 0.6)',
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
        borderRadius: '16px',
        maxWidth: '560px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(71, 85, 105, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
          background: 'rgba(30, 41, 59, 0.5)',
        }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#F8FAFC' }}>
            📬 Chi tiết thông báo
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '8px',
              borderRadius: '8px',
              background: 'rgba(71, 85, 105, 0.3)',
              border: 'none',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '18px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '60vh' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
              Đang tải...
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#EF4444' }}>
              {error}
            </div>
          ) : notification ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Title */}
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#F8FAFC' }}>
                {notification.title}
              </h3>

              {/* Meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: notification.is_broadcast 
                    ? 'rgba(168, 85, 247, 0.15)' 
                    : 'rgba(56, 189, 248, 0.15)',
                  border: `1px solid ${notification.is_broadcast 
                    ? 'rgba(168, 85, 247, 0.3)' 
                    : 'rgba(56, 189, 248, 0.3)'}`,
                  color: notification.is_broadcast ? '#A855F7' : '#38BDF8',
                  fontSize: '13px',
                  fontWeight: 500,
                }}>
                  {notification.is_broadcast ? '📢 Broadcast' : '👤 Targeted'}
                </span>
                <span style={{ color: '#64748B', fontSize: '13px' }}>
                  🕐 {formatDate(notification.created_at)}
                </span>
              </div>

              {/* Stats (for admin view) */}
              {notification.stats && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#F8FAFC' }}>
                      {notification.stats.total_recipients}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Người nhận</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#22C55E' }}>
                      {notification.stats.read_count}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Đã đọc</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: '#FBBF24' }}>
                      {notification.stats.unread_count}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>Chưa đọc</div>
                  </div>
                </div>
              )}

              {/* Read Rate Progress */}
              {notification.stats && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '13px', color: '#94A3B8' }}>Tỷ lệ đọc</span>
                    <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: 600 }}>
                      {getReadRate()}%
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    borderRadius: '4px',
                    background: 'rgba(71, 85, 105, 0.4)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${getReadRate()}%`,
                      height: '100%',
                      background: (getReadRate() || 0) > 50 
                        ? 'linear-gradient(90deg, #22C55E, #16A34A)' 
                        : 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}

              {/* Content */}
              <div style={{
                padding: '16px',
                borderRadius: '12px',
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
              }}>
                <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', fontWeight: 500 }}>
                  NỘI DUNG
                </div>
                <div 
                  style={{ 
                    color: '#E2E8F0', 
                    fontSize: '14px', 
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}
                  dangerouslySetInnerHTML={{ 
                    __html: notification.content || notification.content_preview || 'Không có nội dung' 
                  }}
                />
              </div>

              {/* Gift Section - Show if has gift data */}
              {hasGift && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(234, 179, 8, 0.1))',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                }}>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#FCD34D', 
                    marginBottom: '12px', 
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🎁 Quà tặng kèm theo
                  </div>
                  
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                    {(notification.gift_data?.coins || 0) > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.2)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                      }}>
                        <span style={{ fontSize: '20px' }}>💎</span>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#FCD34D' }}>
                            {notification.gift_data?.coins?.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '11px', color: '#F59E0B' }}>Tinh Thạch</div>
                        </div>
                      </div>
                    )}
                    {(notification.gift_data?.gems || 0) > 0 && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid rgba(168, 85, 247, 0.3)',
                      }}>
                        <span style={{ fontSize: '20px' }}>✨</span>
                        <div>
                          <div style={{ fontSize: '18px', fontWeight: 700, color: '#C4B5FD' }}>
                            {notification.gift_data?.gems?.toLocaleString()}
                          </div>
                          <div style={{ fontSize: '11px', color: '#A855F7' }}>Nguyên Thần</div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Item List - Show item names */}
                  {(notification.gift_data?.item_ids?.length || 0) > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#22D3EE', marginBottom: '8px', fontWeight: 500 }}>
                        🎁 Vật phẩm ({notification.gift_data?.item_ids?.length})
                      </div>
                      {loadingItems ? (
                        <div style={{ color: '#94A3B8', fontSize: '12px' }}>Đang tải...</div>
                      ) : giftItems.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {giftItems.map(item => (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                background: 'rgba(34, 211, 238, 0.1)',
                                border: `1px solid ${getRarityColor(item.rarity)}40`,
                              }}
                            >
                              <span style={{ color: '#F8FAFC', fontSize: '13px' }}>
                                {item.name}
                              </span>
                              <span style={{ 
                                color: getRarityColor(item.rarity), 
                                fontSize: '11px',
                                textTransform: 'capitalize',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: `${getRarityColor(item.rarity)}20`,
                              }}>
                                {item.rarity || 'common'}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ color: '#94A3B8', fontSize: '12px' }}>
                          {notification.gift_data?.item_ids?.length} vật phẩm
                        </div>
                      )}
                    </div>
                  )}

                  {/* Claim Button or Status */}
                  {claimResult ? (
                    <div style={{
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid rgba(34, 197, 94, 0.4)',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎉</div>
                      <div style={{ color: '#86EFAC', fontWeight: 600 }}>
                        Đã nhận thành công!
                      </div>
                      <div style={{ color: '#22C55E', fontSize: '13px', marginTop: '4px' }}>
                        {claimResult.coins > 0 && `+${claimResult.coins.toLocaleString()} Tinh Thạch `}
                        {claimResult.gems > 0 && `+${claimResult.gems.toLocaleString()} Nguyên Thần `}
                        {claimResult.items.length > 0 && `+${claimResult.items.length} vật phẩm`}
                      </div>
                      {claimResult.items.length > 0 && giftItems.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '12px', color: '#86EFAC' }}>
                          {giftItems.map(item => item.name).join(', ')}
                        </div>
                      )}
                    </div>
                  ) : notification.gift_claimed ? (
                    <div style={{
                      padding: '10px',
                      borderRadius: '8px',
                      background: 'rgba(71, 85, 105, 0.3)',
                      textAlign: 'center',
                      color: '#94A3B8',
                      fontSize: '13px',
                    }}>
                      ✅ Bạn đã nhận quà này rồi
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleClaimGift}
                        disabled={claiming}
                        style={{
                          width: '100%',
                          padding: '12px',
                          borderRadius: '8px',
                          background: claiming 
                            ? 'rgba(71, 85, 105, 0.4)' 
                            : 'linear-gradient(135deg, #F59E0B, #D97706)',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '15px',
                          fontWeight: 600,
                          cursor: claiming ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: claiming ? 'none' : '0 4px 12px rgba(245, 158, 11, 0.4)',
                          transition: 'all 0.2s ease',
                        }}
                      >
                        {claiming ? (
                          <>⏳ Đang nhận...</>
                        ) : (
                          <>🎁 Nhận quà ngay</>
                        )}
                      </button>
                      {claimError && (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          borderRadius: '6px',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#FCA5A5',
                          fontSize: '13px',
                          textAlign: 'center',
                        }}>
                          {claimError}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Gift Stats (Admin view) */}
              {notification.gift_stats && hasGift && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(71, 85, 105, 0.3)',
                }}>
                  <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>
                    THỐNG KÊ NHẬN QUÀ
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div>
                      <span style={{ color: '#22C55E', fontWeight: 600 }}>
                        {notification.gift_stats.claimed_count}
                      </span>
                      <span style={{ color: '#64748B', fontSize: '12px' }}> đã nhận</span>
                    </div>
                    <div>
                      <span style={{ color: '#FBBF24', fontWeight: 600 }}>
                        {notification.gift_stats.unclaimed_count}
                      </span>
                      <span style={{ color: '#64748B', fontSize: '12px' }}> chưa nhận</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(71, 85, 105, 0.3)',
          background: 'rgba(30, 41, 59, 0.3)',
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(71, 85, 105, 0.4)',
              border: 'none',
              color: '#F8FAFC',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationDetailModal
