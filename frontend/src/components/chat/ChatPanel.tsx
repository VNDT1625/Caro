import React from 'react'
import { useChat } from '../../hooks/useChat'
import type { ChatChannelScope, ChatMessage } from '../../types/chat'

type AllowedChannel = Extract<ChatChannelScope, 'global' | 'friends' | 'room'>

interface ChatPanelProps {
  mode: 'home' | 'room'
  userId?: string
  displayName?: string
  roomId?: string | null
  enabled?: boolean
  variant?: 'card' | 'popup' | 'room'
}

const CHANNEL_OPTIONS: Array<{ value: AllowedChannel; label: string }> = [
  { value: 'global', label: 'Toàn cõi' },
  { value: 'friends', label: 'Đạo hữu' },
  { value: 'room', label: 'Trong phòng hiện tại' }
]

const STATUS_COPY: Record<string, string> = {
  idle: 'Chưa kết nối',
  connecting: 'Đang nối truyền âm…',
  connected: 'Đã kết nối',
  error: 'Mất kết nối'
}

function formatTimestamp(iso: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso))
  } catch (e) {
    return ''
  }
}

function renderMessageLabel(message: ChatMessage): string {
  const candidate = message.sender_profile?.display_name || message.sender_profile?.username
  if (candidate) return candidate
  return message.sender_user_id?.slice(0, 6) || 'Ẩn danh'
}

export default function ChatPanel({ mode, userId, displayName, roomId, enabled = true, variant = 'card' }: ChatPanelProps) {
  const [channel, setChannel] = React.useState<AllowedChannel>(mode === 'room' ? 'room' : 'global')
  const [input, setInput] = React.useState('')
  const [localError, setLocalError] = React.useState<string | null>(null)
  const endRef = React.useRef<HTMLDivElement | null>(null)
  const prevCountRef = React.useRef(0)

  React.useEffect(() => {
    if (mode === 'room') {
      setChannel('room')
      return
    }
    if (channel === 'room' && !roomId) {
      setChannel('global')
    }
  }, [channel, mode, roomId])

  const chat = useChat({
    mode,
    channel,
    roomId,
    enabled,
    limit: variant === 'room' ? 40 : 25
  })

  React.useEffect(() => {
    if (chat.messages.length > prevCountRef.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    prevCountRef.current = chat.messages.length
  }, [chat.messages.length])

  const isRoomChannel = channel === 'room'
  const placeholder = isRoomChannel
    ? 'Truyền âm tới đạo hữu trong phòng…'
    : channel === 'friends'
    ? 'Nhắn gọn để gọi đạo hữu…'
    : 'Truyền âm toàn cõi MindPoint…'

  const handleSend = async () => {
    if (!input.trim()) return
    setLocalError(null)
    try {
      await chat.sendMessage(input)
      setInput('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không gửi được truyền âm'
      setLocalError(message)
    }
  }

  const canSend = Boolean(input.trim()) && chat.status !== 'error'

  const showChannelSelector = mode === 'home'

  return (
    <div className={`chat-panel ${variant === 'popup' ? 'chat-panel-popup' : variant === 'room' ? 'chat-panel-room' : ''}`}>
      <div className="chat-header-row">
        <div className="chat-title">Truyền Âm</div>
        <div className={`chat-status chat-status-${chat.status}`}>
          <span className="status-dot" aria-hidden="true"></span>
          {STATUS_COPY[chat.status] || 'Đang xử lý'}
        </div>
      </div>

      {showChannelSelector && (
        <div className="chat-channel-row">
          <label htmlFor="chat-channel">Kênh</label>
          <select
            id="chat-channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as AllowedChannel)}
          >
            {CHANNEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.value === 'room' && !roomId}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="chat-utility-row">
        <button
          className="chat-load-btn"
          onClick={() => chat.loadOlder()}
          disabled={!chat.canLoadMore || chat.isLoading}
        >
          ↑ Tin cũ
        </button>
        {chat.cooldownMs > 0 && (
          <span className="chat-cooldown">Chờ {Math.ceil(chat.cooldownMs / 1000)}s</span>
        )}
      </div>

      <div className="chat-list" role="log" aria-live="polite">
        {chat.isLoading && chat.messages.length === 0 && (
          <div className="chat-placeholder">Đang kết nối đến Mạng Lưới Truyền Âm…</div>
        )}
        {!chat.isLoading && chat.messages.length === 0 && (
          <div className="chat-placeholder">Chưa có đạo hữu nào lên tiếng.</div>
        )}
        {chat.messages.map((message) => {
          const mine = message.sender_user_id === userId
          const label = mine ? (displayName || 'Bạn') : renderMessageLabel(message)
          return (
            <div key={message.id} className={`chat-message ${mine ? 'mine' : ''}`}>
              <div className="chat-message-meta">
                <span className="chat-author">{label}</span>
                <span className="chat-timestamp">{formatTimestamp(message.created_at)}</span>
              </div>
              <div className={`chat-bubble chat-type-${message.message_type}`}>
                {message.content}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          rows={variant === 'room' ? 2 : 3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button className="chat-send-btn" onClick={handleSend} disabled={!canSend}>
          Gửi
        </button>
      </div>

      {(chat.notice || localError || chat.error) && (
        <div className="chat-alert" role="alert">
          <span>{chat.notice || localError || chat.error}</span>
          <button onClick={() => { chat.clearNotice(); setLocalError(null) }} aria-label="Ẩn cảnh báo">
            ×
          </button>
        </div>
      )}

      <p className="chat-ephemeral-hint">
        {variant === 'popup'
          ? 'Đóng popup sẽ xoá lịch sử tạm thời.'
          : 'Rời màn hình này, truyền âm sẽ tải lại để tránh lag.'}
      </p>
    </div>
  )
}
