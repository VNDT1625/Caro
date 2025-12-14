import React from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { supabase } from '../../lib/supabase'
import { useChat } from '../../hooks/useChat'
import type { ChatMessage } from '../../types/chat'
import type { FriendEntry } from '../../hooks/useFriendSystem'
import { findBestCaroAnswer, loadCaroDataset, type CaroQAEntry, addLocalDatasetEntry, addServerDatasetEntry, isDatasetLoaded, getLoadedEntriesCount, searchDatasetOnServer } from '../../lib/caroDataset'
import { recordUnansweredQuestion, exportUnansweredQuestions, getUnansweredQuestions } from '../../lib/question_dataset'

type OverlayTab = 'world' | 'friend' | 'ai'
type AiModel = 'basic' | 'trial' | 'pro'

const AI_BASE_URL = (import.meta.env.VITE_AI_URL || 'https://openrouter.ai/api/v1/chat/completions').replace(/\/$/, '')
const AI_API_KEY = import.meta.env.VITE_AI_API_KEY
// Danh sách API keys phụ để rotate khi key chính gặp rate limit
const AI_API_KEYS_BACKUP = [
  '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',
  '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',
  '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'
].filter(Boolean) // Lọc bỏ các giá trị rỗng
const AI_MODEL = import.meta.env.VITE_AI_MODEL || 'tngtech/deepseek-r1t2-chimera:free'
const TRIAL_EMAIL_REGEX = import.meta.env.VITE_AI_TRIAL_EMAIL_REGEX ? new RegExp(import.meta.env.VITE_AI_TRIAL_EMAIL_REGEX) : null
const AI_MAX_TOKENS = Number(import.meta.env.VITE_AI_MAX_TOKENS || 1200)

// Quản lý key rotation: lưu key hiện tại và index
let currentKeyIndex = 0
let currentKey: string | null = AI_API_KEY || null
const allKeys: string[] = [AI_API_KEY, ...AI_API_KEYS_BACKUP].filter((key): key is string => Boolean(key))

// Hàm để lấy key tiếp theo khi gặp rate limit
function getNextApiKey(): string | null {
  if (allKeys.length === 0) return null
  currentKeyIndex = (currentKeyIndex + 1) % allKeys.length
  currentKey = allKeys[currentKeyIndex]
  console.log(`[API Key Rotation] Switched to key ${currentKeyIndex + 1}/${allKeys.length}`)
  return currentKey
}

// Reset về key đầu tiên (có thể gọi sau một khoảng thời gian)
function resetToFirstKey() {
  if (allKeys.length > 0) {
    currentKeyIndex = 0
    currentKey = allKeys[0]
    console.log('[API Key Rotation] Reset to first key')
  }
}

interface HomeChatOverlayProps {
  isOpen: boolean
  onClose: () => void
  userId?: string
  displayName?: string
  friends: FriendEntry[]
  initialTab?: OverlayTab
  initialActiveFriend?: string | null
  onAiMessagesUpdate?: (messages: AiMessage[]) => void
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

function enrichPrompt(raw: string, previousUserMessage?: string, languageCode: string = 'vi') {
  const trimmed = raw.trim()
  const lower = trimmed.toLowerCase()
  const hasCaro = /caro|gomoku|co caro|c\u1edd caro/.test(lower)
  const short = trimmed.split(/\s+/).filter(Boolean).length <= 5

  if (short && previousUserMessage) {
    return `Trong b\u1ed1i c\u1ea3nh tr\u00f2 ch\u01a1i C\u1edd Caro/gomoku, gh\u00e9p y\u1ebfu c\u00e2u ng\u01b0\u1eddi d\u00f9ng tr\u01b0\u1edbc: "${previousUserMessage}". B\u1ed5 sung: "${trimmed}". Tr\u1ea3 l\u1eddi r\u00f5 r\u00e0ng, ng\u1eafn g\u1ecdn.`
  }

  if (!hasCaro) {
    return `Trong b\u1ed1i c\u1ea3nh tr\u00f2 ch\u01a1i C\u1edd Caro/gomoku, ${trimmed}`
  }

  return trimmed
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

async function callHostedAi(model: AiModel, prompt: string, userId?: string, languageCode: string = 'vi') {
  // Sử dụng key hiện tại (có thể đã được rotate)
  const apiKey = currentKey || AI_API_KEY
  if (!apiKey) throw new Error('Thiếu VITE_AI_API_KEY')
  
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  headers['Authorization'] = `Bearer ${apiKey}`
  // OpenRouter khuyến khích thêm các header sau, nhưng không bắt buộc
  headers['HTTP-Referer'] = window.location.origin
  headers['X-Title'] = 'MindPoint Arena'

  const languageLabel =
    languageCode === 'en'
      ? 'English'
      : languageCode === 'zh'
        ? '中文'
        : languageCode === 'ja'
          ? '日本語'
          : 'tiếng Việt'

  const system = [
    'Bối cảnh: bạn là Cao Nhân Caro trong web game MindPoint Arena (Cờ Caro/gomoku).',
    `Ngôn ngữ trả lời: ${languageLabel}.`,
    'Mục tiêu: trả lời ngắn gọn, đúng trọng tâm, tối đa ~50 từ.',
    'Nếu câu hỏi quá mơ hồ (không rõ chủ đề Caro), yêu cầu người dùng nêu rõ hơn thay vì trả lời chung chung.'
  ].join(' ')

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `[mode:${model}] ${prompt}` }
    ],
    stream: false,
    max_tokens: AI_MAX_TOKENS,
    temperature: model === 'pro' ? 0.7 : 0.6,
    presence_penalty: 0.1,
    frequency_penalty: 0.3
  }

  // Retry logic với exponential backoff cho rate limit (429) và key rotation
  const maxRetries = 3
  let lastError: Error | null = null
  // Sử dụng key hiện tại (có thể đã được rotate từ lần gọi trước)
  let currentApiKey = currentKey || AI_API_KEY
  if (!currentApiKey) throw new Error('Thiếu VITE_AI_API_KEY')
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.min(2000 * Math.pow(2, attempt - 1), 8000)
      console.log(`[callHostedAi] Retry attempt ${attempt}/${maxRetries} after ${delay}ms delay...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    // Update headers với key hiện tại (có thể đã rotate)
    const requestHeaders: Record<string, string> = { ...headers }
    requestHeaders['Authorization'] = `Bearer ${currentApiKey}`
    
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 41000) // 41s timeout

    let res: Response
    try {
      res = await fetch(AI_BASE_URL, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal
      })
    } catch (err: any) {
      clearTimeout(timeout)
      if (err?.name === 'AbortError') {
        throw new Error('Timeout khi gọi AI (quá 41s). Thử lại hoặc chọn câu hỏi ngắn hơn.')
      }
      if (attempt < maxRetries) {
        lastError = err
        continue // Retry on network errors
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
    
    if (!res.ok) {
      // Nếu gặp 429 và có nhiều keys, thử rotate key trước khi retry
      if (res.status === 429 && allKeys.length > 1) {
        const nextKey = getNextApiKey()
        if (nextKey && nextKey !== currentApiKey) {
          console.log(`[callHostedAi] Rate limited (429) with key ${currentKeyIndex === 0 ? currentKeyIndex : currentKeyIndex - 1}, rotating to key ${currentKeyIndex + 1}/${allKeys.length}...`)
          currentApiKey = nextKey
          lastError = new Error(`AI HTTP ${res.status}`)
          continue // Retry với key mới ngay lập tức (không delay)
        }
      }
      
      // Retry on 429 (rate limit) or 5xx errors với delay
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const retryAfter = res.headers.get('Retry-After')
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : undefined
        if (delay) {
          console.log(`[callHostedAi] Rate limited (429), waiting ${delay}ms as suggested by server...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        lastError = new Error(`AI HTTP ${res.status}`)
        continue
      }
      
      // For other errors, throw immediately
      if (res.status === 429) {
        // Tạo error đặc biệt để có thể fallback về dataset
        const error = new Error('AI đang quá tải (rate limit). Vui lòng đợi vài giây rồi thử lại.') as Error & { isRateLimit?: boolean }
        error.isRateLimit = true
        throw error
      }
      if (res.status === 401 || res.status === 403) {
        throw new Error('API key không hợp lệ hoặc hết quota. Kiểm tra VITE_AI_API_KEY.')
      }
      throw new Error(`AI HTTP ${res.status}`)
    }
    
    // Success - parse response
    const data = await res.json()
    const choice = data?.choices?.[0]
    const msg = choice?.message
    const finishReason = choice?.finish_reason || choice?.native_finish_reason
    // content dạng chuỗi
    if (msg?.content) {
      if (Array.isArray(msg.content)) {
        const joined = msg.content
          .map((c: any) => (typeof c === 'string' ? c : c?.text || c?.content || ''))
          .join('\n')
          .trim()
        if (joined) return joined
      } else if (typeof msg.content === 'string' && msg.content.trim()) {
        return msg.content.trim()
      }
    }
    // Nếu content trống nhưng có reasoning -> dùng reasoning
    if (!msg?.content && typeof msg?.reasoning === 'string' && msg.reasoning.trim()) {
      const reasonText = msg.reasoning.trim()
      return finishReason === 'length'
        ? `${reasonText}\n\n(Lưu ý: câu trả lời bị cắt do giới hạn độ dài, thử hỏi ngắn hơn hoặc cụ thể hơn.)`
        : reasonText
    }
    if (data?.answer) return data.answer as string
    if (Array.isArray(data?.messages)) {
      const assistantMsg = data.messages.find((m: any) => m.role === 'assistant')
      if (assistantMsg?.content) return assistantMsg.content
    }
    // Fallback an toàn nếu model trả trống: tự trả lời ngắn gọn theo chủ đề Caro
    const lowerPrompt = prompt.toLowerCase()
    const isHistory = /(lịch sử|nguồn gốc|hình thành)/.test(lowerPrompt)
    const isTournament = /(giải đấu|tournament)/.test(lowerPrompt)
    if (isHistory || isTournament) {
      return 'Tóm tắt nhanh: Cờ Caro (gomoku) bắt nguồn từ Nhật thời Edo, lan sang Trung/Hàn (omok). Giải đấu online hiện nay dùng bàn 15x15/vô hạn, thắng khi xếp 5 quân liên tiếp.'
    }
    return 'Câu hỏi quá mơ hồ - hãy nói rõ hơn (ví dụ: luật Caro, chiến thuật, lịch sử, giải đấu...).'
  }
  
  // Nếu đã retry hết mà vẫn lỗi
  if (lastError) {
    throw lastError
  }
  
  throw new Error('Không thể kết nối đến AI service')
}

export default function HomeChatOverlay({
  isOpen,
  onClose,
  userId,
  displayName,
  friends,
  initialTab = 'world',
  initialActiveFriend,
  onAiMessagesUpdate
}: HomeChatOverlayProps) {
  const { language, t } = useLanguage()
  const [tab, setTab] = React.useState<OverlayTab>(initialTab)
  const [friendSearch, setFriendSearch] = React.useState('')
  const [activeFriend, setActiveFriend] = React.useState<string | null>(
    initialActiveFriend ?? friends[0]?.friend_id ?? null
  )
  const [worldDraft, setWorldDraft] = React.useState('')
  const [friendDraft, setFriendDraft] = React.useState('')
  const [aiDraft, setAiDraft] = React.useState('')
  const [aiModel, setAiModel] = React.useState<AiModel>('basic')
  const [aiMessages, setAiMessages] = React.useState<AiMessage[]>([])
  const [aiLoading, setAiLoading] = React.useState(false)
  const [localWorld, setLocalWorld] = React.useState<LocalMessage[]>([])
  const [localFriends, setLocalFriends] = React.useState<LocalMessage[]>([])
  const [datasetStatus, setDatasetStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [datasetError, setDatasetError] = React.useState<string | null>(null)
  const [effectiveUserId, setEffectiveUserId] = React.useState<string | undefined>(userId)
  const [trialAllowed, setTrialAllowed] = React.useState<boolean>(false)
  const [proAllowed, setProAllowed] = React.useState<boolean>(false)
  const [userPlan, setUserPlan] = React.useState<string>('free')
  const [unansweredCount, setUnansweredCount] = React.useState<number>(0)

  const worldListRef = React.useRef<HTMLDivElement | null>(null)
  const friendListRef = React.useRef<HTMLDivElement | null>(null)
  const datasetRef = React.useRef<CaroQAEntry[]>([])

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const uid = userId || data.session?.user?.id
      if (!cancelled && uid) {
        setEffectiveUserId(uid)
        
        // Fetch user profile to check plan
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('plan, trial_expires_at, pro_expires_at')
          .eq('user_id', uid)
          .single()
        
        if (!cancelled && profile && !error) {
          const now = new Date()
          const plan = profile.plan || 'free'
          setUserPlan(plan)
          
          // Check trial: plan phải là 'trial' hoặc 'pro' và chưa hết hạn
          const trialExpires = profile.trial_expires_at ? new Date(profile.trial_expires_at) : null
          const isTrialValid = plan === 'trial' && (!trialExpires || trialExpires > now)
          const isProValid = plan === 'pro' && (!profile.pro_expires_at || new Date(profile.pro_expires_at) > now)
          
          // Trial được phép nếu plan là trial (còn hạn) hoặc pro (còn hạn)
          setTrialAllowed(isTrialValid || isProValid)
          // Pro chỉ được phép nếu plan là pro và còn hạn
          setProAllowed(isProValid)
        } else {
          // Không có profile hoặc lỗi -> chỉ cho dùng free
          setTrialAllowed(false)
          setProAllowed(false)
          setUserPlan('free')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    setUnansweredCount(getUnansweredQuestions().length)
  }, [])

  const worldChat = useChat({
    mode: 'home',
    channel: 'global',
    userId: effectiveUserId,
    enabled: isOpen && tab === 'world' && Boolean(effectiveUserId),
    limit: 50
  })
  const friendChat = useChat({
    mode: 'home',
    channel: 'friends',
    userId: effectiveUserId,
    enabled: isOpen && tab === 'friend' && Boolean(effectiveUserId),
    limit: 50,
    targetUserId: activeFriend
  })

  React.useEffect(() => {
    if (!isOpen) return
    setTab(initialTab)
    setActiveFriend((prev) => initialActiveFriend ?? prev ?? friends[0]?.friend_id ?? null)
  }, [friends, initialTab, isOpen, initialActiveFriend])

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

  const sortedWorldMessages = React.useMemo((): LocalMessage[] => {
    const merged: LocalMessage[] = [...worldChat.messages, ...localWorld]
    return merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }, [localWorld, worldChat.messages])

  const sortedFriendMessages = React.useMemo((): LocalMessage[] => {
    const merged: LocalMessage[] = [...friendChat.messages, ...localFriends].filter((msg) => {
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

  const loadFreeDataset = React.useCallback(async () => {
    if (datasetStatus === 'loading') return datasetRef.current
    if (datasetStatus === 'ready' && datasetRef.current.length) return datasetRef.current
    
    // Kiểm tra xem dataset đã được preload chưa (từ App.tsx)
    if (isDatasetLoaded()) {
      console.log(`[HomeChatOverlay] Using preloaded dataset (${getLoadedEntriesCount()} entries)`)
    }
    
    setDatasetStatus('loading')
    setDatasetError(null)
    try {
      // Load dataset theo ngôn ngữ của user để chỉ lấy entries cùng ngôn ngữ
      // Nếu đã preload, loadCaroDataset sẽ return cache ngay lập tức
      const data = await Promise.race([
        loadCaroDataset(language), // Truyền language vào để filter
        new Promise<CaroQAEntry[]>((resolve) => 
          setTimeout(() => {
            // Nếu timeout nhưng có preload data, dùng nó
            if (isDatasetLoaded()) {
              console.warn('[HomeChatOverlay] Timeout but using preloaded data')
              loadCaroDataset(language).then(resolve).catch(() => resolve([]))
            } else {
              console.warn('[HomeChatOverlay] Dataset load timeout, returning empty')
              resolve([])
            }
          }, 4000)
        )
      ])
      datasetRef.current = data
      if (data.length === 0) {
        setDatasetStatus('error')
        setDatasetError('Dataset trống hoặc quá lâu. Hãy dùng Trial/Pro.')
      } else {
        setDatasetStatus('ready')
      }
      return data
    } catch (err) {
      console.error('Load caro_dataset.jsonl failed', err)
      setDatasetStatus('error')
      setDatasetError('Không tải được dữ liệu. Hãy dùng Trial/Pro.')
      return []
    }
  }, [datasetStatus, language])

  React.useEffect(() => {
    if (!isOpen) return
    // Chỉ load dataset khi user thực sự chọn Free mode và gửi tin nhắn
    // Không tự động load khi mở tab để tránh treo
  }, [isOpen, tab])

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
      // giữ temp cho tới khi realtime trả về, reconciliation sẽ gỡ
    } catch (err) {
      // nếu lỗi (cooldown/offline), bỏ temp để tránh hiểu nhầm
      setLocalWorld((prev) => prev.filter((msg) => msg.id !== tempId))
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
      // giữ temp cho tới khi realtime trả về, reconciliation sẽ gỡ
    } catch (err) {
      setLocalFriends((prev) => prev.filter((msg) => msg.id !== tempId))
    }
  }

  const sendAi = async () => {
    const prompt = aiDraft.trim()
    if (!prompt) return
    const lastUserMsg = [...aiMessages].reverse().find((m) => m.role === 'user')?.content
    const enrichedPrompt = enrichPrompt(prompt, lastUserMsg, language)
    setAiDraft('')
    const userMessage: AiMessage = { id: `u-${Date.now()}`, role: 'user', content: prompt }
    setAiMessages((prev) => [...prev, userMessage])
    setAiLoading(true)
    try {
      let reply = ''
      if (aiModel === 'basic') {
        // Load dataset chỉ khi cần thiết (lazy loading)
        let dataset = datasetRef.current
        if (dataset.length === 0 && datasetStatus !== 'error') {
          dataset = await loadFreeDataset()
        }
        
        if (dataset.length) {
          // Dung cau hoi goc de so khop dataset, tranh noise tu prompt bo sung
          const hit = findBestCaroAnswer(prompt, dataset)
          if (hit && hit.score >= 0.6) {
            const hints = []
            if (hit.entry.topic) hints.push(hit.entry.topic)
            if (hit.entry.difficulty) hints.push(hit.entry.difficulty)
            const meta = hints.length ? ` (${hints.join(' - ')})` : ''
            const matched = hit.matchedText ? `\n\nNguon${meta}: ${hit.matchedText}` : ''
            reply = `${hit.entry.answer}${matched}`
          } else {
            recordUnansweredQuestion({
              question: prompt,
              normalized: enrichedPrompt,
              source: 'free',
              userId: effectiveUserId || null
            })
            setUnansweredCount((prev) => prev + 1)
            reply = 'Câu hỏi chưa có trong dữ liệu Free. Bạn có thể hỏi rõ hơn hoặc chọn Trial/Pro.'
          }
        } else {
          // Fallback: thử server-side search nếu frontend dataset không load được
          console.log('[sendAi] Frontend dataset empty, trying server-side search...')
          try {
            const serverHit = await searchDatasetOnServer(prompt, language)
            if (serverHit && serverHit.score >= 0.6) {
              const hints = []
              if (serverHit.entry.topic) hints.push(serverHit.entry.topic)
              if (serverHit.entry.difficulty) hints.push(serverHit.entry.difficulty)
              const meta = hints.length ? ` (${hints.join(' - ')})` : ''
              reply = `${serverHit.entry.answer}\n\n(Server search${meta})`
            } else {
              reply = 'Không thể tải dữ liệu Free. Vui lòng chọn Trial hoặc Pro để tiếp tục.'
            }
          } catch (serverErr) {
            console.warn('[sendAi] Server-side search failed:', serverErr)
            reply = 'Không thể tải dữ liệu Free. Vui lòng chọn Trial hoặc Pro để tiếp tục.'
          }
        }
      } else {
        if (aiModel === 'trial' && !trialAllowed) {
          throw new Error('Trial chỉ dành cho tài khoản Trial/Pro. Vui lòng nâng cấp gói để sử dụng.')
        }
        if (aiModel === 'pro' && !proAllowed) {
          throw new Error('Pro chỉ dành cho tài khoản Pro. Vui lòng nâng cấp gói để sử dụng.')
        }
        // Ưu tiên trả lời nhanh từ dataset nếu khớp cao để giảm độ trễ Trial/Pro
        const dataset = datasetStatus === 'ready' ? datasetRef.current : await loadFreeDataset()
        if (dataset.length && !reply) {
          const hit = findBestCaroAnswer(prompt, dataset)
          if (hit && hit.score >= 0.9) {
            reply = `${hit.entry.answer}\n\n(Nguon nhanh: dataset, do phu hop ${Math.round(hit.score * 100)}%)`
          }
        }
        try {
          if (!reply) {
            try {
              reply = await callHostedAi(aiModel, enrichedPrompt, effectiveUserId, language)
            } catch (aiError: any) {
              // Nếu gặp rate limit (429), fallback về dataset nếu có
              if (aiError?.isRateLimit && dataset.length > 0) {
                console.warn('[sendAi] AI rate limited, falling back to dataset...')
                const hit = findBestCaroAnswer(prompt, dataset)
                if (hit && hit.score >= 0.6) {
                  reply = `${hit.entry.answer}\n\n(⚠️ AI đang quá tải, dùng dataset thay thế. Độ phù hợp: ${Math.round(hit.score * 100)}%)`
                } else {
                  throw aiError // Nếu dataset không có câu trả lời phù hợp, throw error gốc
                }
              } else {
                throw aiError // Re-throw nếu không phải rate limit hoặc không có dataset
              }
            }
          }
          if (aiModel === 'trial' && reply) {
            // Gửi lên server để lưu vào caro_dataset.jsonl chung (tất cả user đều dùng được)
            // Quan trọng: lưu kèm language để phân tách dataset theo ngôn ngữ
            try {
              const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
              if (sessionError) {
                console.error('[sendAi] Error getting session:', sessionError)
              }
              
              // Debug: log toàn bộ session structure
              console.log('[sendAi] Full session data:', JSON.stringify(sessionData, null, 2))
              
              // Cấu trúc: data.session.access_token (không phải data.session.session.access_token)
              let token = sessionData?.session?.access_token || null
              
              if (!token) {
                console.error('[sendAi] No access token found in session. User may need to login again.')
                console.log('[sendAi] Session keys:', sessionData ? Object.keys(sessionData) : 'null')
                console.log('[sendAi] Session.session keys:', sessionData?.session ? Object.keys(sessionData.session) : 'null')
              } else {
                console.log('[sendAi] Token found, length:', token.length)
                
                // Check if token is about to expire and refresh if needed
                try {
                  const tokenParts = token.split('.')
                  if (tokenParts.length === 3) {
                    const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')))
                    const exp = payload.exp
                    const now = Math.floor(Date.now() / 1000)
                    const timeUntilExpiry = exp - now
                    
                    console.log('[sendAi] Token expires in:', timeUntilExpiry, 'seconds')
                    
                    // Refresh if less than 5 minutes until expiry
                    if (timeUntilExpiry < 300) {
                      console.log('[sendAi] Token expiring soon, refreshing...')
                      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
                      if (refreshError) {
                        console.error('[sendAi] Failed to refresh token:', refreshError)
                      } else if (refreshData?.session?.access_token) {
                        token = refreshData.session.access_token
                        console.log('[sendAi] Token refreshed successfully')
                      }
                    }
                  }
                } catch (decodeErr) {
                  console.warn('[sendAi] Failed to decode token for expiry check:', decodeErr)
                }
              }
              
              const serverResult = await addServerDatasetEntry({
                question: prompt,
                paraphrases: [],
                answer: reply,
                topic: 'auto',
                difficulty: 'beginner'
              }, language, token) // Truyền language vào
              
              if (serverResult.success) {
                console.log(`✅ Dataset entry đã được lưu vào server (language: ${language})`)
              } else {
                console.warn('⚠️ Không thể lưu vào server, lưu vào localStorage làm backup:', serverResult.error)
                // Fallback: lưu vào localStorage nếu server fail
                addLocalDatasetEntry({
                  question: prompt,
                  paraphrases: [],
                  answer: reply,
                  topic: 'auto',
                  difficulty: 'beginner',
                  language: language // Lưu language vào localStorage backup
                })
              }
            } catch (err) {
              console.error('Error saving dataset entry:', err)
              // Fallback: lưu vào localStorage nếu có lỗi
              addLocalDatasetEntry({
                question: prompt,
                paraphrases: [],
                answer: reply,
                topic: 'auto',
                difficulty: 'beginner',
                language: language // Lưu language vào localStorage backup
              })
            }
          }
        } catch (error: any) {
          console.error('Hosted AI failed', error)
          const reason = typeof error?.message === 'string' ? error.message : 'API error'
          reply = `Không gọi được AI (${aiModel}). Kiểm tra VITE_AI_URL / VITE_AI_API_KEY / CORS. Chi tiết: ${reason}`
        }
        // Lưu lại câu hỏi + câu trả lời (trial/pro) để tăng dữ liệu sau này
        recordUnansweredQuestion({
          question: prompt,
          normalized: enrichedPrompt,
          answer: reply,
          model: aiModel,
          source: aiModel,
          userId: effectiveUserId || null
        })
        setUnansweredCount((prev) => prev + 1)
      }
      setAiMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: reply, model: aiModel }
      ])
    } catch (err) {
      console.error('AI chat failed', err)
      setAiMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: 'Cao Nhan gap loi khi tra loi. Thu lai sau.', model: aiModel }
      ])
    } finally {
      setAiLoading(false)
    }
  }

  // Sync AI messages to parent when closing
  const handleClose = () => {
    if (onAiMessagesUpdate && aiMessages.length > 0) {
      onAiMessagesUpdate(aiMessages)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="home-chat-overlay" onClick={handleClose}>
      <div className="home-chat-card" onClick={(e) => e.stopPropagation()}>
        <div className="home-chat-header">
          <div>
            <div className="home-chat-title">{t('homeChat.title')}</div>
            <div className="home-chat-subtitle">{t('homeChat.subtitle')}</div>
          </div>
          <button className="home-chat-close" onClick={handleClose} aria-label={t('homeChat.close')}>
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
            {t('homeChat.tabWorld')}
          </button>
          <button
            className={tab === 'friend' ? 'active' : ''}
            onClick={() => {
              setTab('friend')
              void friendChat.refresh()
            }}
          >
            {t('homeChat.tabFriend')}
          </button>
          <button className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            {t('homeChat.tabAi')}
          </button>
        </div>

        {tab === 'world' && (
          <div className="home-chat-body">
            {(!effectiveUserId || worldChat.status === 'error') && (
              <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                {!effectiveUserId ? t('homeChat.loginToSend') : t('homeChat.chatOffline')}
              </div>
            )}
            <div className="home-chat-toolbar">
              <span className="badge">
                {worldChat.status === 'connected'
                  ? t('homeChat.online')
                  : worldChat.status === 'connecting'
                    ? t('homeChat.connecting')
                    : t('homeChat.offline')}
              </span>
              <span className="badge">{t('homeChat.cooldown')}</span>
              {worldChat.cooldownMs > 0 && <span className="home-chat-cooldown">{t('homeChat.cooldownRemaining', { seconds: Math.ceil(worldChat.cooldownMs / 1000) })}</span>}
            </div>
            <div className="home-chat-messages" ref={worldListRef}>
              {worldChat.status === 'connecting' && sortedWorldMessages.length === 0 && (
                <div className="home-chat-helper" style={{ marginBottom: 8 }}>
                  {t('homeChat.connectingRealtime')}
                </div>
              )}
              {worldChat.status === 'error' && sortedWorldMessages.length === 0 && (
                <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                  {t('homeChat.chatOfflineRetry')}
                </div>
              )}
              {sortedWorldMessages.length === 0 && worldChat.status !== 'error' && (
                <div className="home-chat-empty">{t('homeChat.noMessages')}</div>
              )}
              {sortedWorldMessages.map((msg) => {
                const mine = msg.sender_user_id === effectiveUserId
                return (
                  <div key={msg.id} className={`home-chat-row ${mine ? 'mine' : ''}`}>
                    <div className="home-chat-meta">
                      <span className="home-chat-author">{mine ? (displayName || t('homeChat.you')) : friendLabel(friends, msg.sender_user_id)}</span>
                      <span className="home-chat-time">{formatClock(msg.created_at)}</span>
                      {msg.local && <span className="home-chat-tag">{t('homeChat.local')}</span>}
                    </div>
                    <div className="home-chat-bubble">{msg.content}</div>
                  </div>
                )
              })}
            </div>
            <div className="home-chat-input">
              <textarea
                placeholder={effectiveUserId ? t('homeChat.worldPlaceholder') : t('homeChat.worldPlaceholderLogin')}
                value={worldDraft}
                onChange={(e) => setWorldDraft(e.target.value)}
                readOnly={!effectiveUserId || worldChat.cooldownMs > 0}
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
                    {t('homeChat.refresh')}
                  </button>
                )}
                <button onClick={sendWorld} disabled={!worldDraft.trim() || worldChat.cooldownMs > 0 || !effectiveUserId}>
                  {t('homeChat.send')}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'friend' && (
          <div className="home-chat-body">
            {(!effectiveUserId || friendChat.status === 'error') && (
              <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                {t('homeChat.demoMode')}
              </div>
            )}
            <div className="home-chat-toolbar">
              <span className="badge">
                {friendChat.status === 'connected'
                  ? t('homeChat.online')
                  : friendChat.status === 'connecting'
                    ? t('homeChat.connecting')
                    : t('homeChat.offline')}
              </span>
              <div className="toolbar-row">
                <input
                  className="home-chat-search"
                  value={friendSearch}
                  onChange={(e) => setFriendSearch(e.target.value)}
                  placeholder={t('homeChat.searchFriend')}
                />
                {friendChat.status !== 'connected' && (
                  <button className="ghost" onClick={() => friendChat.refresh()}>
                    {t('homeChat.refresh')}
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
              {filteredFriends.length === 0 && <span className="home-chat-helper">{t('homeChat.noFriendsFound')}</span>}
            </div>
            <div className="home-chat-messages" ref={friendListRef}>
              {sortedFriendMessages.length === 0 && <div className="home-chat-empty">{t('homeChat.noFriendMessages')}</div>}
              {sortedFriendMessages.map((msg) => {
                const mine = msg.sender_user_id === effectiveUserId
                const label = mine ? (displayName || t('homeChat.you')) : friendLabel(friends, msg.sender_user_id)
                return (
                  <div key={msg.id} className={`home-chat-row ${mine ? 'mine' : ''}`}>
                    <div className="home-chat-meta">
                      <span className="home-chat-author">{label}</span>
                      <span className="home-chat-time">{formatClock(msg.created_at)}</span>
                      {msg.local && <span className="home-chat-tag">{t('homeChat.local')}</span>}
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
                    ? t('homeChat.friendPlaceholderLogin')
                    : activeFriend
                      ? t('homeChat.friendPlaceholder')
                      : t('homeChat.friendPlaceholderSelect')
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
                    {t('homeChat.refresh')}
                  </button>
                )}
                <button onClick={sendFriend} disabled={!friendDraft.trim() || !activeFriend || !effectiveUserId}>
                  {t('homeChat.send')}
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
                  <input type="radio" checked={aiModel === 'basic'} onChange={() => setAiModel('basic')} /> {t('homeChat.aiModelFree')}
                </label>
                <label title={!trialAllowed ? t('homeChat.aiNeedTrial') : ''}>
                  <input type="radio" checked={aiModel === 'trial'} onChange={() => setAiModel('trial')} disabled={!trialAllowed} /> {t('homeChat.aiModelTrial')}
                  {!trialAllowed && <span className="plan-lock">🔒</span>}
                </label>
                <label title={!proAllowed ? t('homeChat.aiNeedPro') : ''}>
                  <input type="radio" checked={aiModel === 'pro'} onChange={() => setAiModel('pro')} disabled={!proAllowed} /> {t('homeChat.aiModelPro')}
                  {!proAllowed && <span className="plan-lock">🔒</span>}
                </label>
              </div>
              <span className="home-chat-helper">
                {t('homeChat.aiHelper')}
                {userPlan === 'free' && ` ${t('homeChat.aiPlanFree')}`}
                {userPlan === 'trial' && ` ${t('homeChat.aiPlanTrial')}`}
                {userPlan === 'pro' && ` ${t('homeChat.aiPlanPro')}`}
                {aiModel === 'basic' && datasetStatus === 'loading' && ` ${t('homeChat.aiLoadingDataset')}`}
                {aiModel === 'basic' && datasetStatus === 'error' && ` ${t('homeChat.aiDatasetError')}`}
              </span>
            </div>
            <div className="home-chat-messages ai">
              {aiModel === 'basic' && datasetStatus === 'loading' && aiMessages.length === 0 && (
                <div className="home-chat-helper" style={{ marginBottom: 8 }}>
                  {t('homeChat.aiLoadingHint')}
                </div>
              )}
              {aiModel === 'basic' && datasetStatus === 'error' && aiMessages.length === 0 && (
                <div className="home-chat-helper" style={{ marginBottom: 8, color: '#f87171' }}>
                  {datasetError || t('homeChat.aiDatasetErrorHint')}
                </div>
              )}
              {aiMessages.length === 0 && <div className="home-chat-empty">{t('homeChat.aiNoMessages')}</div>}
              {aiMessages.map((msg) => (
                <div key={msg.id} className={`home-chat-row ${msg.role === 'user' ? 'mine' : ''}`}>
                  <div className="home-chat-meta">
                    <span className="home-chat-author">
                      {msg.role === 'user' ? (displayName || t('homeChat.you')) : msg.model?.toUpperCase() || 'AI'}
                    </span>
                  </div>
                  <div className="home-chat-bubble">{msg.content}</div>
                </div>
              ))}
            </div>
            <div className="home-chat-input">
              <textarea
                placeholder={t('homeChat.aiPlaceholder')}
                value={aiDraft}
                onChange={(e) => setAiDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendAi()
                  }
                }}
              />
              <button
                onClick={sendAi}
                disabled={!aiDraft.trim() || aiLoading}
              >
                {aiLoading ? t('homeChat.aiAsking') : t('homeChat.aiAsk')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
