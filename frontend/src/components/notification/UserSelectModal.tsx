import React, { useState, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { searchUsers } from '../../lib/notificationApi'

interface User {
  id: string
  username: string
}

interface UserSelectModalProps {
  selectedUsers: User[]
  onSelect: (users: User[]) => void
  onClose: () => void
}

const UserSelectModal: React.FC<UserSelectModalProps> = ({
  selectedUsers,
  onSelect,
  onClose
}) => {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<User[]>(selectedUsers)

  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const users = await searchUsers(query)
        setResults(users)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setLoading(false)
      }
    }

    const debounce = setTimeout(search, 300)
    return () => clearTimeout(debounce)
  }, [query])

  const toggleUser = (user: User) => {
    setSelected(prev => {
      const exists = prev.find(u => u.id === user.id)
      if (exists) {
        return prev.filter(u => u.id !== user.id)
      }
      return [...prev, user]
    })
  }

  const isSelected = (userId: string) => {
    return selected.some(u => u.id === userId)
  }

  const handleConfirm = () => {
    onSelect(selected)
    onClose()
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
        maxWidth: '480px',
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
            👥 Chọn người nhận
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

        {/* Search */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên người dùng..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.4)',
              color: '#F8FAFC',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Selected Users */}
        {selected.length > 0 && (
          <div style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
            background: 'rgba(56, 189, 248, 0.05)',
          }}>
            <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px' }}>
              Đã chọn: {selected.length} người
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {selected.map(user => (
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
                    onClick={() => toggleUser(user)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#EF4444',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: '14px',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div style={{ padding: '12px 20px', overflowY: 'auto', maxHeight: '300px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
              Đang tìm...
            </div>
          ) : query.length < 2 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '14px' }}>
              Nhập ít nhất 2 ký tự để tìm kiếm
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '14px' }}>
              Không tìm thấy người dùng
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {results.map(user => {
                const checked = isSelected(user.id)
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: checked ? 'rgba(56, 189, 248, 0.15)' : 'rgba(30, 41, 59, 0.5)',
                      border: `1px solid ${checked ? 'rgba(56, 189, 248, 0.3)' : 'rgba(71, 85, 105, 0.3)'}`,
                      color: checked ? '#38BDF8' : '#E2E8F0',
                      fontSize: '14px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span>{user.username}</span>
                    {checked && (
                      <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid rgba(71, 85, 105, 0.3)',
          background: 'rgba(30, 41, 59, 0.3)',
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              background: 'rgba(71, 85, 105, 0.4)',
              border: 'none',
              color: '#F8FAFC',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              border: 'none',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Xác nhận ({selected.length})
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserSelectModal
