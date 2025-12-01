import React from 'react'
import { supabase } from '../../lib/supabase'
import { useChat } from '../../hooks/useChat'
import type { ChatMessage } from '../../types/chat'
import type { FriendEntry } from '../../hooks/useFriendSystem'
import { findBestCaroAnswer, loadCaroDataset, type CaroQAEntry } from '../../lib/caroDataset'

type OverlayTab = 'world' | 'friend' | 'ai'
type AiModel = 'basic' | 'trial' | 'pro'

interface HomeChatOverlayProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  displayName?: string
  friends: FriendEntry[]
  initialTab?: OverlayTab
}

interface LocalMessage extends ChatMessage {
  local?: boolean
  target_user_id?: string | null
}

interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model?: AiModel
}

function formatClock(iso?: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function friendLabel(friends: FriendEntry[], id?: string | null) {
  if (!id) return 'An danh'
  const entry = friends.find((f) => f.friend_id === id || f.profile?.user_id === id)
  return entry?.profile?.display_name || entry?.profile?.username || id.slice(0, 6)
}

async function simulateAiResponse(model: AiModel, prompt: string): Promise<string> {
  const lower = prompt.toLowerCase()
  if (model === 'basic') {
    if (lower.includes('luat')) return 'Caro: 5 quan lien tuc (ngang/doc/cheo) la thang.'
    if (lower.includes('mo di')) return 'Mo dau: chiem trung tam hoac cat duong 3/4 doi thu, tao song song.'
    return 'Hoi ve luat, meo choi, tinh thang... (demo).'
  }
  const tag = model === 'trial' ? 'DeepSeek demo' : 'ChatGPT demo'
  return `${tag}: can noi API that de tra loi chinh xac.`
}

export default function HomeChatOverlay({
  isOpen,
  onClose,
  userId,
  displayName,
  friends,
  initialTab = 'world'
}: HomeChatOverlayProps) {
  const [tab, setTab] = React.useState<OverlayTab>(initialTab)
  const [friendSearch, setFriendSearch] = React.useState('')
  const [activeFriend, setActiveFriend] = React.useState<string | null>(friends[0]?.friend_id ?? null)
  const [worldDraft, setWorldDraft] = React.useState('')
  const [friendDraft, setFriendDraft] = React.useState('')
  const [aiDraft, setAiDraft] = React.useState('')
  const [aiModel, setAiModel] = React.useState<AiModel>('basic')
  const [aiMessages, setAiMessages] = React.useState<AiMessage[]>([])
  const [aiLoading, setAiLoading] = React.useState(false)
  const [localWorld, setLocalWorld] = React.useState<LocalMessage[]>([])
  const [localFriends, setLocalFriends] = React.useState<LocalMessage[]>([])
  const [effectiveUserId, setEffectiveUserId] = React.useState<string | undefined>(userId)

  const worldListRef = React.useRef<HTMLDivElement | null>(null)
  const friendListRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (userId) {
      setEffectiveUserId(userId)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const uid = data.session?.user?.id
      if (!cancelled && uid) setEffectiveUserId(uid)
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  const worldChat = useChat({
    mode: 'home',
    channel: 'global',
    enabled: isOpen && tab === 'world' && Boolean(effectiveUserId),
    limit: 50
  })
  const friendChat = useChat({
    mode: 'home',
    channel: 'friends',
    enabled: isOpen && tab === 'friend' && Boolean(effectiveUserId),
    limit: 50,
    targetUserId: activeFriend
  })

  React.useEffect(() => {
    if (!isOpen) return
    setTab(initialTab)
    setActiveFriend((prev) => prev ?? friends[0]?.friend_id ?? null)
  }, [friends, initialTab, isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    if (worldListRef.current) worldListRef.current.scrollTop = worldListRef.current.scrollHeight
  }, [worldChat.messages.length, localWorld.length, isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    if (friendListRef.current) friendListRef.current.scrollTop = friendListRef.current.scrollHeight
  }, [friendChat.messages.length, localFriends.length, activeFriend, isOpen])

  const filteredFriends = React.useMemo(() => {
    const term = friendSearch.trim().toLowerCase()
    return friends.filter((f) => {
      const name = (f.profile?.display_name || f.profile?.username || '').toLowerCase()
      return !term || name.includes(term)
    })
  }, [friends, friendSearch])

  const sortedWorldMessages = React.useMemo(() => {
    const merged = [...worldChat.messages, ...localWorld]
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [localWorld, worldChat.messages])

  const sortedFriendMessages = React.useMemo(() => {
    const merged = [...friendChat.messages, ...localFriends].filter((msg) => {
      if (!activeFriend) return true
      return (
        msg.sender_user_id === activeFriend ||
        msg.sender_user_id === effectiveUserId ||
        msg.target_user_id === activeFriend
      )
    })
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [activeFriend, effectiveUserId, friendChat.messages, localFriends])

  // Reconcile: khi server đẩy tin thật về, bỏ tin tạm trùng nội dung của chính mình
  React.useEffect(() => {
    if (!effectiveUserId) return
    setLocalWorld((prev) =>
      prev.filter(
        (local) =>
          !worldChat.messages.some(
            (msg) =>
              msg.sender_user_id === effectiveUserId &&
              msg.channel_scope === 'global' &&
              msg.content === local.content
          )
      )
    )
  }, [effectiveUserId, worldChat.messages])

  React.useEffect(() => {
    if (!effectiveUserId) return
    setLocalFriends((prev) =>
      prev.filter(
        (local) =>
          !friendChat.messages.some(
            (msg) =>
              msg.sender_user_id === effectiveUserId &&
              msg.channel_scope === 'friends' &&
              msg.content === local.content &&
              (local.target_user_id ? msg.target_user_id === local.target_user_id : true)
          )
      )
    )
  }, [effectiveUserId, friendChat.messages])

  const sendWorld = async () => {
    const payload = worldDraft.trim()
    if (!payload) return
    setWorldDraft('')
    const tempId = `local-${Date.now()}`
    const tempMsg: LocalMessage = {
      id: tempId,
      sender_user_id: effectiveUserId || 'me',
      content: payload,
      created_at: new Date().toISOString(),
      message_type: 'text',
      channel_scope: 'global',
      local: true
    }
    setLocalWorld((prev) => [...prev, tempMsg])
    try {
      await worldChat.sendMessage(payload)
      // giữ tin tạm đến khi server đẩy về, reconcile ở useEffect
    } catch (err) {
      // giữ temp nếu offline
    }
  }

  const sendFriend = async () => {
    const payload = friendDraft.trim()
    if (!payload || !activeFriend) return
    setFriendDraft('')
    const tempId = `local-${Date.now()}`
    const tempMsg: LocalMessage = {
      id: tempId,
      sender_user_id: effectiveUserId || 'me',
      target_user_id: activeFriend,
      content: payload,
      created_at: new Date().toISOString(),
      message_type: 'text',
      channel_scope: 'friends',
      local: true
    }
    setLocalFriends((prev) => [...prev, tempMsg])
    try {
      await friendChat.sendMessage(payload)
      // giữ tin tạm đến khi server đẩy về, reconcile ở useEffect
    } catch (err) {
      // giữ temp nếu offline
    }
  }

  const sendAi = async () => {
    const prompt = aiDraft.trim()
    if (!prompt) return
    setAiDraft('')
    const userMessage: AiMessage = { id: `u-${Date.now()}`, role: 'user', content: prompt }
    setAiMessages((prev) => [...prev, userMessage])
    setAiLoading(true)
    try {
      const reply = await simulateAiResponse(aiModel, prompt)
      setAiMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: reply, model: aiModel }
      ])
    } finally {
      setAiLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="home-chat-overlay" onClick={onClose}>
      <div className="home-chat-card" onClick={(e) => e.stopPropagation()}>
        <div className="home-chat-header">
          <div>
            <div className="home-chat-title">Truyen Am & Cao nhan</div>
            <div className="home-chat-subtitle">Tin nhan tam thoi</div>
          </div>
          <button className="home-chat-close" onClick={onClose} aria-label="Dong">
            x
          </button>
        </div>

        <div className="home-chat-tabs">
          <button
            className={tab === 'world' ? 'active' : ''}
            onClick={() => {
              setTab('world')
              void worldChat.refresh()
            }}
          >
            The gioi
          </button>
          <button
            className={tab === 'friend' ? 'active' : ''}
            onClick={() => {
              setTab('friend')
              void friendChat.refresh()
            }}
          >
            Ban be
          </button>
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            Cao nhan AI
          </button>
        </div>

        {tab === 'world' && (
          <div className="home-chat-body">
            {(!effectiveUserId || worldChat.status === 'error') && (
              <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                {!effectiveUserId ? 'Dang nhap de gui tin that.' : 'Chat offline, tin nhan chi luu tai cho.'}
              </div>
            )}
            <div className="home-chat-toolbar">
              <span className="badge">
                {worldChat.status === 'connected'
                  ? 'Online'
                  : worldChat.status === 'connecting'
                    ? 'Dang ket noi...'
                    : 'Offline'}
              </span>
              <span className="badge">Cooldown 30s</span>
              {worldChat.cooldownMs > 0 && <span className="home-chat-cooldown">Con {Math.ceil(worldChat.cooldownMs / 1000)}s</span>}
            </div>
            <div className="home-chat-messages" ref={worldListRef}>
              {sortedWorldMessages.map((msg) => {
                const mine = msg.sender_user_id === effectiveUserId
                return (
                  <div key={msg.id} className={`home-chat-row ${mine ? 'mine' : ''}`}>
                    <div className="home-chat-meta">
                      <span className="home-chat-author">{mine ? (displayName || 'Ban') : friendLabel(friends, msg.sender_user_id)}</span>
                      <span className="home-chat-time">{formatClock(msg.created_at)}</span>
                      {msg.local && <span className="home-chat-tag">local</span>}
                    </div>
                    <div className="home-chat-bubble">{msg.content}</div>
                  </div>
                )
              })}
            </div>
            <div className="home-chat-input">
              <textarea
                placeholder={effectiveUserId ? 'Chat The Gioi - 30s/lan' : 'Dang nhap de chat The Gioi'}
                value={worldDraft}
                onChange={(e) => setWorldDraft(e.target.value)}
                readOnly={!effectiveUserId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendWorld()
                  }
                }}
              />
              <div className="home-chat-actions">
                {worldChat.status !== 'connected' && (
                  <button className="ghost" onClick={() => worldChat.refresh()}>
                    Lam moi
                  </button>
                )}
                <button onClick={sendWorld} disabled={!worldDraft.trim() || worldChat.cooldownMs > 0 || !effectiveUserId}>
                  Gui
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'friend' && (
          <div className="home-chat-body">
            {(!effectiveUserId || friendChat.status === 'error') && (
              <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                Che do demo: tin nhan chi luu tai cho. Dang nhap va bat server chat de gui that.
              </div>
            )}
            <div className="home-chat-toolbar">
              <span className="badge">
                {friendChat.status === 'connected'
                  ? 'Online'
                  : friendChat.status === 'connecting'
                    ? 'Dang ket noi...'
                    : 'Offline'}
              </span>
              <div className="toolbar-row">
                <input
                  className="home-chat-search"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder="Tim ban de tro chuyen"
                />
                {friendChat.status !== 'connected' && (
                  <button className="ghost" onClick={() => friendChat.refresh()}>
                    Lam moi
                  </button>
                )}
              </div>
            </div>
            <div className="home-chat-friend-chips">
              {filteredFriends.map((entry) => {
                const label = entry.profile?.display_name || entry.profile?.username || entry.friend_id.slice(0, 6)
                return (
                  <button
                    key={entry.friend_id}
                    className={`friend-chip ${activeFriend === entry.friend_id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveFriend(entry.friend_id)
                      void friendChat.refresh()
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              {filteredFriends.length === 0 && <span className="home-chat-helper">Khong tim thay ban be phu hop</span>}
            </div>
            <div className="home-chat-messages" ref={friendListRef}>
              {sortedFriendMessages.length === 0 && <div className="home-chat-empty">Chua co tin nhan. Chon dao huu de bat dau.</div>}
              {sortedFriendMessages.map((msg) => {
                const mine = msg.sender_user_id === effectiveUserId
                const label = mine ? (displayName || 'Ban') : friendLabel(friends, msg.sender_user_id)
                return (
                  <div key={msg.id} className={`home-chat-row ${mine ? 'mine' : ''}`}>
                    <div className="home-chat-meta">
                      <span className="home-chat-author">{label}</span>
                      <span className="home-chat-time">{formatClock(msg.created_at)}</span>
                      {msg.local && <span className="home-chat-tag">local</span>}
                    </div>
                    <div className="home-chat-bubble">{msg.content}</div>
                  </div>
                )
              })}
            </div>
            <div className="home-chat-input">
              <textarea
                placeholder={
                  !effectiveUserId
                    ? 'Dang nhap de chat dao huu'
                    : activeFriend
                      ? 'Nhan rieng toi dao huu da chon'
                      : 'Chon dao huu de bat dau'
                }
                value={friendDraft}
                onChange={(e) => setFriendDraft(e.target.value)}
                disabled={!activeFriend || !effectiveUserId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendFriend()
                  }
                }}
              />
              <div className="home-chat-actions">
                {friendChat.status !== 'connected' && (
                  <button className="ghost" onClick={() => friendChat.refresh()}>
                    Lam moi
                  </button>
                )}
                <button onClick={sendFriend} disabled={!friendDraft.trim() || !activeFriend || !effectiveUserId}>
                  Gui
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="home-chat-body">
            <div className="home-chat-toolbar ai">
              <div className="ai-models">
                <label>
                  <input type="radio" checked={aiModel === 'basic'} onChange={() => setAiModel('basic')} /> Basic
                </label>
                <label>
                  <input type="radio" checked={aiModel === 'trial'} onChange={() => setAiModel('trial')} /> Trial
                </label>
                <label>
                  <input type="radio" checked={aiModel === 'pro'} onChange={() => setAiModel('pro')} /> Pro
                </label>
              </div>
              <span className="home-chat-helper">Hoi luat, meo choi Caro. Demo - can ket noi API that.</span>
            </div>
            <div className="home-chat-messages ai">
              {aiMessages.length === 0 && <div className="home-chat-empty">Bat dau hoi Cao nhan ve Caro.</div>}
              {aiMessages.map((msg) => (
                <div key={msg.id} className={`home-chat-row ${msg.role === 'user' ? 'mine' : ''}`}>
                  <div className="home-chat-meta">
                    <span className="home-chat-author">
                      {msg.role === 'user' ? (displayName || 'Ban') : msg.model?.toUpperCase() || 'AI'}
                    </span>
                  </div>
                  <div className="home-chat-bubble">{msg.content}</div>
                </div>
              ))}
            </div>
            <div className="home-chat-input">
              <textarea
                placeholder="Nhap cau hoi Caro cho AI"
                value={aiDraft}
                onChange={(e) => setAiDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendAi()
                  }
                }}
              />
              <button onClick={sendAi} disabled={!aiDraft.trim() || aiLoading}>
                {aiLoading ? 'Dang tra loi...' : 'Hoi'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

