import React, { useState, useEffect } from 'react'
import { useNotifications } from '../hooks/useNotifications'
import { useLanguage } from '../contexts/LanguageContext'
import NotificationDetailModal from '../components/notification/NotificationDetailModal'

type FilterType = 'all' | 'unread'

// Notification type icons
const getTypeIcon = (type?: string) => {
  switch (type) {
    case 'system': return '⚙️'
    case 'match': return '⚔️'
    case 'friend': return '👥'
    case 'reward': return '🎁'
    case 'event': return '🎉'
    case 'warning': return '⚠️'
    default: return '📬'
  }
}

const Inbox: React.FC = () => {
  const { t } = useLanguage()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    refresh
  } = useNotifications()

  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  const handleNotificationClick = async (id: string) => {
    setSelectedId(id)
    const notification = notifications.find(n => n.id === id)
    if (notification && !notification.is_read) {
      await markAsRead(id)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    await deleteNotification(id)
    setDeletingId(null)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return t('inbox.justNow') || 'Vừa xong'
    if (minutes < 60) return `${minutes} ${t('inbox.minutesAgo') || 'phút trước'}`
    if (hours < 24) return `${hours} ${t('inbox.hoursAgo') || 'giờ trước'}`
    if (days === 1) return t('inbox.yesterday') || 'Hôm qua'
    if (days < 7) return `${days} ${t('inbox.daysAgo') || 'ngày trước'}`
    return date.toLocaleDateString('vi-VN')
  }

  return (
    <div className="inbox-page">
      <style>{`
        .inbox-page {
          min-height: 100vh;
          padding: 20px;
          background: transparent;
        }
        
        .inbox-container {
          max-width: 700px;
          margin: 0 auto;
        }
        
        /* Header */
        .inbox-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          padding: 16px 20px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 27, 75, 0.8));
          backdrop-filter: blur(20px);
          border-radius: 16px;
          border: 1px solid rgba(139, 92, 246, 0.3);
        }
        
        .inbox-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .inbox-back-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(139, 92, 246, 0.3));
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 12px;
          color: #C4B5FD;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .inbox-back-btn:hover {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.5), rgba(139, 92, 246, 0.5));
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        
        .inbox-title-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .inbox-icon {
          font-size: 28px;
        }
        
        .inbox-title {
          font-size: 24px;
          font-weight: 700;
          color: #E0E7FF;
          margin: 0;
          text-shadow: 0 2px 10px rgba(139, 92, 246, 0.3);
        }
        
        .inbox-badge {
          background: linear-gradient(135deg, #F43F5E, #E11D48);
          color: white;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          box-shadow: 0 2px 8px rgba(244, 63, 94, 0.5);
          animation: pulse-badge 2s infinite;
        }
        
        @keyframes pulse-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        
        .inbox-header-actions {
          display: flex;
          gap: 8px;
        }
        
        .inbox-action-btn {
          padding: 10px 16px;
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(139, 92, 246, 0.3));
          border: 1px solid rgba(139, 92, 246, 0.4);
          border-radius: 10px;
          color: #E0E7FF;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        
        .inbox-action-btn:hover {
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(139, 92, 246, 0.5));
          border-color: rgba(139, 92, 246, 0.6);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
        }
        
        .inbox-action-btn.primary {
          background: linear-gradient(135deg, #8B5CF6, #6366F1);
          border-color: transparent;
          color: white;
        }
        
        .inbox-action-btn.primary:hover {
          background: linear-gradient(135deg, #7C3AED, #4F46E5);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
        }
        
        /* Filter Tabs */
        .inbox-filters {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
          padding: 4px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 12px;
          width: fit-content;
        }
        
        .inbox-filter-btn {
          padding: 10px 20px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: rgba(196, 181, 253, 0.7);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .inbox-filter-btn:hover {
          color: #C4B5FD;
          background: rgba(139, 92, 246, 0.15);
        }
        
        .inbox-filter-btn.active {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4));
          color: #E0E7FF;
        }
        
        .filter-count {
          background: rgba(139, 92, 246, 0.3);
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
        }
        
        .inbox-filter-btn.active .filter-count {
          background: rgba(139, 92, 246, 0.6);
        }
        
        /* Notification List */
        .inbox-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .inbox-empty {
          text-align: center;
          padding: 60px 20px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.5), rgba(30, 27, 75, 0.4));
          border-radius: 16px;
          border: 1px dashed rgba(139, 92, 246, 0.3);
        }
        
        .inbox-empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.6;
        }
        
        .inbox-empty-text {
          color: rgba(196, 181, 253, 0.6);
          font-size: 15px;
        }
        
        .inbox-loading {
          text-align: center;
          padding: 40px;
          color: rgba(196, 181, 253, 0.7);
        }
        
        .inbox-error {
          text-align: center;
          padding: 40px;
          color: #FCA5A5;
          background: rgba(239, 68, 68, 0.15);
          border-radius: 12px;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
        
        /* Notification Item */
        .notification-item {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 16px;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(30, 27, 75, 0.5));
          border-radius: 14px;
          border: 1px solid rgba(139, 92, 246, 0.15);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        
        .notification-item::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: transparent;
          transition: background 0.2s ease;
        }
        
        .notification-item.unread::before {
          background: linear-gradient(180deg, #8B5CF6, #6366F1);
        }
        
        .notification-item:hover {
          background: linear-gradient(135deg, rgba(30, 27, 75, 0.7), rgba(49, 46, 129, 0.6));
          border-color: rgba(139, 92, 246, 0.4);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(139, 92, 246, 0.2);
        }
        
        .notification-item.unread {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1));
          border-color: rgba(139, 92, 246, 0.3);
        }
        
        .notification-item.deleting {
          opacity: 0.5;
          pointer-events: none;
        }
        
        .notification-icon {
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
          border-radius: 12px;
          font-size: 20px;
          flex-shrink: 0;
          border: 1px solid rgba(139, 92, 246, 0.2);
        }
        
        .notification-item.unread .notification-icon {
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.4));
          border-color: rgba(139, 92, 246, 0.4);
        }
        
        .notification-content {
          flex: 1;
          min-width: 0;
        }
        
        .notification-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        
        .notification-unread-dot {
          width: 8px;
          height: 8px;
          background: #8B5CF6;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 8px rgba(139, 92, 246, 0.8);
        }
        
        .notification-title {
          font-size: 15px;
          font-weight: 600;
          color: #E0E7FF;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .notification-item:not(.unread) .notification-title {
          color: rgba(196, 181, 253, 0.8);
        }
        
        .notification-preview {
          font-size: 13px;
          color: rgba(196, 181, 253, 0.6);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          margin-bottom: 8px;
        }
        
        .notification-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: rgba(196, 181, 253, 0.5);
        }
        
        .notification-sender {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .notification-time {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        
        .notification-broadcast-tag {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.3));
          color: #C4B5FD;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .notification-gift-tag {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.4), rgba(234, 179, 8, 0.4));
          color: #FCD34D;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          animation: gift-pulse 1.5s infinite;
        }
        
        @keyframes gift-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 8px 2px rgba(245, 158, 11, 0.6); }
        }
        
        .notification-gift-claimed-tag {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(22, 163, 74, 0.3));
          color: #86EFAC;
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
        }
        
        .notification-delete-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: rgba(196, 181, 253, 0.4);
          cursor: pointer;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .notification-delete-btn:hover {
          background: rgba(239, 68, 68, 0.25);
          color: #FCA5A5;
        }
        
        /* Load More */
        .inbox-load-more {
          width: 100%;
          padding: 14px;
          margin-top: 8px;
          background: rgba(99, 102, 241, 0.1);
          border: 1px dashed rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          color: rgba(196, 181, 253, 0.7);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .inbox-load-more:hover:not(:disabled) {
          background: rgba(139, 92, 246, 0.2);
          color: #E0E7FF;
          border-color: rgba(139, 92, 246, 0.5);
        }
        
        .inbox-load-more:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        
        /* Responsive */
        @media (max-width: 640px) {
          .inbox-page {
            padding: 12px;
          }
          
          .inbox-header {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }
          
          .inbox-header-left {
            justify-content: space-between;
          }
          
          .inbox-header-actions {
            justify-content: flex-end;
          }
          
          .inbox-filters {
            width: 100%;
          }
          
          .inbox-filter-btn {
            flex: 1;
            justify-content: center;
          }
          
          .notification-item {
            padding: 12px;
          }
          
          .notification-icon {
            width: 38px;
            height: 38px;
            font-size: 18px;
          }
        }
      `}</style>

      <div className="inbox-container">
        {/* Header */}
        <div className="inbox-header">
          <div className="inbox-header-left">
            <button
              className="inbox-back-btn"
              onClick={() => window.history.back()}
              aria-label={t('common.back') || 'Quay lại'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="inbox-title-group">
              <span className="inbox-icon">📬</span>
              <h1 className="inbox-title">{t('inbox.title') || 'Hộp thư'}</h1>
              {unreadCount > 0 && (
                <span className="inbox-badge">{unreadCount}</span>
              )}
            </div>
          </div>
          
          <div className="inbox-header-actions">
            <button
              className="inbox-action-btn"
              onClick={refresh}
              title={t('inbox.refresh') || 'Làm mới'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>{t('inbox.refresh') || 'Làm mới'}</span>
            </button>
            {unreadCount > 0 && (
              <button
                className="inbox-action-btn primary"
                onClick={markAllAsRead}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{t('inbox.markAllRead') || 'Đọc tất cả'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="inbox-filters">
          <button
            className={`inbox-filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            📋 {t('inbox.all') || 'Tất cả'}
          </button>
          <button
            className={`inbox-filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            🔔 {t('inbox.unread') || 'Chưa đọc'}
            {unreadCount > 0 && <span className="filter-count">{unreadCount}</span>}
          </button>
        </div>

        {/* Notification List */}
        <div className="inbox-list">
          {loading && notifications.length === 0 ? (
            <div className="inbox-loading">
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
              {t('common.loading') || 'Đang tải...'}
            </div>
          ) : error ? (
            <div className="inbox-error">
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>❌</div>
              {error}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="inbox-empty">
              <div className="inbox-empty-icon">
                {filter === 'unread' ? '✅' : '📭'}
              </div>
              <div className="inbox-empty-text">
                {filter === 'unread'
                  ? (t('inbox.noUnread') || 'Không có thông báo chưa đọc')
                  : (t('inbox.empty') || 'Hộp thư trống')}
              </div>
            </div>
          ) : (
            <>
              {filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.is_read ? 'unread' : ''} ${deletingId === notification.id ? 'deleting' : ''}`}
                  onClick={() => handleNotificationClick(notification.id)}
                >
                  <div className="notification-icon">
                    {getTypeIcon((notification as any).type)}
                  </div>
                  
                  <div className="notification-content">
                    <div className="notification-header">
                      {!notification.is_read && <div className="notification-unread-dot" />}
                      <div className="notification-title">{notification.title}</div>
                    </div>
                    <div className="notification-preview">
                      {notification.content_preview}
                    </div>
                    <div className="notification-meta">
                      <span className="notification-sender">
                        👤 {notification.sender_name}
                      </span>
                      <span>•</span>
                      <span className="notification-time">
                        🕐 {formatDate(notification.created_at)}
                      </span>
                      {notification.is_broadcast && (
                        <span className="notification-broadcast-tag">
                          📢 {t('inbox.broadcast') || 'Thông báo chung'}
                        </span>
                      )}
                      {notification.has_gift && !notification.gift_claimed && (
                        <span className="notification-gift-tag">
                          🎁 {t('inbox.hasGift') || 'Có quà'}
                        </span>
                      )}
                      {notification.has_gift && notification.gift_claimed && (
                        <span className="notification-gift-claimed-tag">
                          ✅ {t('inbox.giftClaimed') || 'Đã nhận'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <button
                    className="notification-delete-btn"
                    onClick={(e) => handleDelete(notification.id, e)}
                    title={t('inbox.delete') || 'Xóa'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Load More */}
              {hasMore && (
                <button
                  className="inbox-load-more"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading 
                    ? (t('common.loading') || 'Đang tải...') 
                    : (t('inbox.loadMore') || '📥 Tải thêm thông báo')}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedId && (
        <NotificationDetailModal
          notificationId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  )
}

export default Inbox
