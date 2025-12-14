/**
 * AIChatPanel - Chat với AI về trận đấu
 * 
 * Cho phép người dùng hỏi AI về trận đấu đang phân tích
 * Gọi trực tiếp OpenRouter API giống HomeChatOverlay
 * 
 * Tính năng: Khi AI phát hiện gian lận (vai trò 3), hiển thị button báo cáo
 */

import { useState, useRef, useEffect } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import ReportModal from '../report/ReportModal'

// OpenRouter API config
const AI_BASE_URL = ((import.meta.env as any).VITE_AI_URL || 'https://openrouter.ai/api/v1/chat/completions').replace(/\/$/, '')
const AI_API_KEY = (import.meta.env as any).VITE_AI_API_KEY
const AI_MODEL = (import.meta.env as any).VITE_AI_MODEL || 'tngtech/deepseek-r1t2-chimera:free'

// Keywords để phát hiện AI xác nhận có gian lận/bất thường
const CHEAT_DETECTION_KEYWORDS = [
  'phát hiện gian lận',
  'có dấu hiệu gian lận',
  'nghi ngờ gian lận',
  'bất thường nghiêm trọng',
  'vi phạm luật',
  'hack',
  'cheat',
  'đi nhiều hơn',
  'đi 2 nước liên tiếp',
  'đi lên quân đã có',
  'nên báo cáo',
  'khuyên báo cáo',
  'hãy báo cáo',
  'báo cáo quản trị',
  'report admin',
  'detected cheating',
  'suspicious activity',
  'rule violation'
]

// Kiểm tra xem AI response có xác nhận gian lận không
function detectCheatConfirmation(content: string): boolean {
  const lowerContent = content.toLowerCase()
  return CHEAT_DETECTION_KEYWORDS.some(keyword => lowerContent.includes(keyword.toLowerCase()))
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  showReportButton?: boolean // Flag để hiển thị button báo cáo
}

interface AnalysisContext {
  mistakes: Array<{ move: number; severity: string; desc: string }>
  patterns: Array<{ label: string; explanation: string }>
  bestMove: { x: number; y: number; reason: string } | null
  timeline: Array<{ move: number; score: number; category: string }>
}

interface AIChatPanelProps {
  chatHistory: ChatMessage[]
  loading: boolean
  disabled?: boolean
  analysisContext?: AnalysisContext | null
  onSendMessage: (message: string) => Promise<string>
  onClearChat: () => void
  // Props cho chức năng báo cáo
  matchId?: string
  opponentUserId?: string // ID của đối thủ để báo cáo
}

const QUICK_QUESTIONS = [
  'Tại sao tôi thua trận này?',
  'Nước đi nào là sai lầm lớn nhất?',
  'Trận này có gì bất thường không?',
  'Tôi nên cải thiện điều gì?',
  'Giải thích luật cấm trong Caro',
]

// Helper: delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper: format message content for better line breaks
function formatMessageContent(content: string): string {
  if (!content) return ''
  
  let formatted = content
  
  // Ensure line breaks after emoji bullets (🎯, 📊, ✨, etc.)
  formatted = formatted.replace(/([🎯📊✨💡🔍⚡🛡️❌✅⚠️💔🎮📖])\s*/g, '\n$1 ')
  
  // Ensure line breaks after numbered items (1., 2., etc.)
  formatted = formatted.replace(/(\d+\.)\s*/g, '\n$1 ')
  
  // Ensure line breaks after bullet points (-, *, •)
  formatted = formatted.replace(/([•\-\*])\s+/g, '\n$1 ')
  
  // Ensure line breaks after colons followed by text (for labels)
  formatted = formatted.replace(/:\s*([A-ZĐ])/g, ':\n$1')
  
  // Ensure double line break before section headers (text ending with :)
  formatted = formatted.replace(/\n([^\n]+:)\s*\n/g, '\n\n$1\n')
  
  // Clean up multiple consecutive newlines (max 2)
  formatted = formatted.replace(/\n{3,}/g, '\n\n')
  
  // Remove leading newline
  formatted = formatted.replace(/^\n+/, '')
  
  return formatted.trim()
}

// Helper: extract content from AI response (handles reasoning models like deepseek-r1)
function extractAIContent(data: any): string {
  console.log('[AIChatPanel] Raw API response:', JSON.stringify(data, null, 2))
  
  const choice = data.choices?.[0]
  if (!choice) {
    console.warn('[AIChatPanel] No choices in response')
    return ''
  }
  
  const msg = choice.message
  const finishReason = choice.finish_reason || choice.native_finish_reason
  console.log('[AIChatPanel] Message object:', JSON.stringify(msg, null, 2))
  console.log('[AIChatPanel] Finish reason:', finishReason)
  
  // 1. Try content field first (can be string or array)
  if (msg?.content) {
    if (Array.isArray(msg.content)) {
      const joined = msg.content
        .map((c: any) => (typeof c === 'string' ? c : c?.text || c?.content || ''))
        .join('\n')
        .trim()
      if (joined) {
        console.log('[AIChatPanel] Found array content, length:', joined.length)
        return joined
      }
    } else if (typeof msg.content === 'string' && msg.content.trim()) {
      console.log('[AIChatPanel] Found string content, length:', msg.content.length)
      return msg.content.trim()
    }
  }
  
  // 2. Fallback to reasoning field (for reasoning models like deepseek-r1)
  // Note: OpenRouter uses "reasoning" not "reasoning_content"
  const reasoning = msg?.reasoning || msg?.reasoning_content
  if (reasoning && typeof reasoning === 'string' && reasoning.trim()) {
    console.log('[AIChatPanel] Using reasoning field, length:', reasoning.length)
    const reasonText = reasoning.trim()
    
    return reasonText
  }
  
  // 3. Check data.answer (some APIs return this)
  if (data?.answer && typeof data.answer === 'string') {
    console.log('[AIChatPanel] Found data.answer')
    return data.answer
  }
  
  // 4. Check messages array
  if (Array.isArray(data?.messages)) {
    const assistantMsg = data.messages.find((m: any) => m.role === 'assistant')
    if (assistantMsg?.content) {
      console.log('[AIChatPanel] Found in messages array')
      return assistantMsg.content
    }
  }
  
  console.warn('[AIChatPanel] No content found in any field')
  return ''
}

// Gọi OpenRouter API với retry mechanism
async function callOpenRouterAI(
  question: string, 
  context?: AnalysisContext | null, 
  language: string = 'vi',
  maxRetries: number = 3
): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error('Thiếu API key. Vui lòng cấu hình VITE_AI_API_KEY.')
  }

  const languageLabel = language === 'en' ? 'English' : language === 'zh' ? '中文' : language === 'jp' ? '日本語' : 'tiếng Việt'
  
  // Build context from analysis
  let analysisInfo = ''
  if (context) {
    if (context.mistakes?.length > 0) {
      analysisInfo += `\nSai lầm trong trận: ${context.mistakes.map(m => `Nước ${m.move} (${m.severity}): ${m.desc}`).join('; ')}`
    }
    if (context.patterns?.length > 0) {
      analysisInfo += `\nMẫu chiến thuật: ${context.patterns.map(p => `${p.label}: ${p.explanation}`).join('; ')}`
    }
    if (context.bestMove) {
      analysisInfo += `\nNước tốt nhất: (${context.bestMove.x + 1},${context.bestMove.y + 1}) - ${context.bestMove.reason}`
    }
    if (context.timeline?.length > 0) {
      analysisInfo += `\nTổng số nước: ${context.timeline.length}`
    }
  }

  const system = [
    `Bạn là trợ lý AI chuyên về Cờ Caro/Gomoku. Ngôn ngữ: ${languageLabel}.`,
    '',
    '**QUY TẮC QUAN TRỌNG NHẤT:**',
    '1. ĐỌC KỸ câu hỏi của người dùng và TRẢ LỜI ĐÚNG câu hỏi đó',
    '2. KHÔNG tự ý chuyển sang chủ đề khác',
    '3. Nếu hỏi về chiến thuật → trả lời về chiến thuật',
    '4. Nếu hỏi về bất thường/hack → kiểm tra và trả lời về bất thường',
    '5. Nếu hỏi tại sao thua → phân tích lý do thua',
    '',
    '**ĐỊNH DẠNG TRẢ LỜI:**',
    '- Chia thành các đoạn ngắn, mỗi ý một dòng',
    '- Dùng emoji để đánh dấu các điểm quan trọng',
    '- Tối đa 150 từ, ngắn gọn súc tích',
    '',
    '**LUẬT CỜ CARO:**',
    '- Thắng: 5 quân liên tiếp (ngang/dọc/chéo)',
    '- X đi trước, sau đó O luân phiên',
    '- Cấm: đi vào ô đã có quân',
    '',
    '**KIỂM TRA GIAN LẬN (chỉ khi được hỏi về bất thường):**',
    '- Đếm số quân X và O có chênh lệch > 1 không',
    '- Có quân đè lên nhau không',
    '- Nếu phát hiện vi phạm → khuyên báo cáo quản trị viên',
    '',
    analysisInfo ? `📊 THÔNG TIN TRẬN:${analysisInfo}` : ''
  ].filter(Boolean).join('\n')

  const payload = {
    model: AI_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: question }
    ],
    stream: false,
    max_tokens: 2000,
    temperature: 0.7
  }

  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutMs = 30000 + (attempt - 1) * 10000 // Increase timeout each retry
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(AI_BASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_API_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'MindPoint Arena Analysis'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error?.message || `API error: ${res.status}`)
      }

      const data = await res.json()
      const content = extractAIContent(data)
      
      if (content) {
        return content
      }
      
      // Empty response, retry
      console.warn(`[AIChatPanel] Empty response on attempt ${attempt}, retrying...`)
      lastError = new Error('AI trả về nội dung trống')
      
    } catch (err: any) {
      clearTimeout(timeout)
      lastError = err
      
      if (err?.name === 'AbortError') {
        console.warn(`[AIChatPanel] Timeout on attempt ${attempt}`)
        lastError = new Error('Timeout - AI phản hồi quá lâu')
      } else {
        console.warn(`[AIChatPanel] Error on attempt ${attempt}:`, err.message)
      }
    }
    
    // Wait before retry (exponential backoff)
    if (attempt < maxRetries) {
      await delay(1000 * attempt)
    }
  }
  
  // All retries failed - provide fallback response
  console.error('[AIChatPanel] All retries failed, using fallback')
  return generateFallbackResponse(question, context, language)
}

// Generate fallback response when API fails
function generateFallbackResponse(
  question: string, 
  context?: AnalysisContext | null,
  language: string = 'vi'
): string {
  const q = question.toLowerCase()
  
  // Vietnamese fallbacks
  if (language === 'vi' || language === 'zh') {
    if (q.includes('thua') || q.includes('lose')) {
      if (context?.mistakes?.length) {
        const bigMistake = context.mistakes.find(m => m.severity === 'blunder' || m.severity === 'mistake')
        if (bigMistake) {
          return `Dựa trên phân tích, sai lầm lớn nhất là ở nước ${bigMistake.move}: ${bigMistake.desc}. Đây có thể là nguyên nhân chính dẫn đến thua trận.`
        }
      }
      return 'Để biết chính xác lý do thua, hãy xem lại các nước đi được đánh dấu là sai lầm trong phần phân tích.'
    }
    
    if (q.includes('sai lầm') || q.includes('mistake')) {
      if (context?.mistakes?.length) {
        return `Trận này có ${context.mistakes.length} sai lầm. ${context.mistakes[0]?.desc || 'Xem chi tiết trong phần phân tích.'}`
      }
      return 'Chưa phát hiện sai lầm rõ ràng. Hãy chạy phân tích để xem chi tiết.'
    }
    
    if (q.includes('bất thường') || q.includes('hack') || q.includes('cheat')) {
      return 'Để phát hiện bất thường, tôi cần xem xét: thời gian phản hồi, pattern nước đi, và các vi phạm luật. Hãy mô tả cụ thể điều gì khiến bạn nghi ngờ.'
    }
    
    if (q.includes('cải thiện') || q.includes('improve')) {
      return 'Để cải thiện, hãy: 1) Học các khai cuộc cơ bản, 2) Luyện nhận diện đe dọa, 3) Không vội vàng - suy nghĩ trước khi đi.'
    }
    
    return 'Xin lỗi, tôi đang gặp khó khăn kết nối. Vui lòng thử lại sau hoặc đặt câu hỏi cụ thể hơn.'
  }
  
  // English fallbacks
  return 'Sorry, I\'m having trouble connecting. Please try again or ask a more specific question.'
}

export default function AIChatPanel({
  chatHistory: externalChatHistory,
  loading: externalLoading,
  disabled,
  analysisContext,
  onSendMessage,
  onClearChat,
  matchId,
  opponentUserId
}: AIChatPanelProps) {
  const { t, language } = useLanguage()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [localLoading, setLocalLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Use local state for messages
  const chatHistory = localMessages.length > 0 ? localMessages : externalChatHistory
  const loading = localLoading || externalLoading
  
  // Kiểm tra xem có thể báo cáo không (cần có matchId và opponentUserId)
  const canReport = Boolean(matchId && opponentUserId)

  // Auto scroll to bottom when new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const handleSend = async () => {
    if (!input.trim() || loading || disabled) return
    
    const question = input.trim()
    setInput('')
    setError(null)
    
    // Add user message immediately
    const userMsg: ChatMessage = { role: 'user', content: question }
    setLocalMessages(prev => [...prev, userMsg])
    setLocalLoading(true)
    
    try {
      // Call OpenRouter directly
      const answer = await callOpenRouterAI(question, analysisContext, language)
      
      // Kiểm tra xem AI có xác nhận gian lận không
      const hasCheatDetection = detectCheatConfirmation(answer)
      
      const assistantMsg: ChatMessage = { 
        role: 'assistant', 
        content: answer,
        showReportButton: hasCheatDetection && canReport
      }
      setLocalMessages(prev => [...prev, assistantMsg])
    } catch (err: any) {
      setError(err.message || 'Không thể gửi câu hỏi')
      // Remove the user message if failed
      setLocalMessages(prev => prev.slice(0, -1))
    } finally {
      setLocalLoading(false)
    }
  }

  const handleClearChat = () => {
    setLocalMessages([])
    setError(null)
    onClearChat()
  }

  const handleQuickQuestion = (q: string) => {
    if (loading || disabled) return
    setInput(q)
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: 'rgba(15,23,42,0.6)',
      borderRadius: 12,
      border: '1px solid rgba(71,85,105,0.35)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid rgba(71,85,105,0.35)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          💬 Hỏi AI về trận đấu
        </div>
        {chatHistory.length > 0 && (
          <button
            onClick={handleClearChat}
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#F87171',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 11,
              cursor: 'pointer'
            }}
          >
            Xóa chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {chatHistory.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#64748B', fontSize: 13, padding: 20 }}>
            <div style={{ marginBottom: 12 }}>Hỏi AI bất cứ điều gì về trận đấu này!</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickQuestion(q)}
                  disabled={disabled}
                  style={{
                    background: 'rgba(56,189,248,0.1)',
                    border: '1px solid rgba(56,189,248,0.3)',
                    color: '#38BDF8',
                    padding: '6px 10px',
                    borderRadius: 6,
                    fontSize: 11,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    opacity: disabled ? 0.5 : 1
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          chatHistory.map((msg, i) => (
            <div
              key={i}
              style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: msg.role === 'user' 
                    ? 'linear-gradient(135deg, #3B82F6, #2563EB)'
                    : 'rgba(51,65,85,0.8)',
                  color: '#F1F5F9',
                  fontSize: 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word'
                }}
              >
                {formatMessageContent(msg.content)}
              </div>
              
              {/* Button báo cáo khi AI phát hiện gian lận */}
              {msg.showReportButton && (
                <button
                  onClick={() => setShowReportModal(true)}
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#EF4444',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(220, 38, 38, 0.25))'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.15))'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  <span>🚩</span>
                  <span>Báo cáo vi phạm</span>
                </button>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '10px 12px',
            borderRadius: '12px 12px 12px 4px',
            background: 'rgba(51,65,85,0.8)',
            color: '#94A3B8',
            fontSize: 13
          }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              background: '#38BDF8',
              borderRadius: '50%',
              marginRight: 6,
              animation: 'pulse 1s infinite'
            }} />
            AI đang suy nghĩ...
          </div>
        )}
        
        {error && (
          <div style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#F87171',
            fontSize: 12
          }}>
            ⚠️ {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: 12,
        borderTop: '1px solid rgba(71,85,105,0.35)',
        display: 'flex',
        gap: 8
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={disabled ? 'Chọn trận đấu để chat...' : 'Nhập câu hỏi...'}
          disabled={disabled || loading}
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid rgba(71,85,105,0.5)',
            background: 'rgba(15,23,42,0.7)',
            color: '#F1F5F9',
            fontSize: 13,
            outline: 'none'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading || disabled}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: (!input.trim() || loading || disabled) 
              ? 'rgba(71,85,105,0.5)' 
              : 'linear-gradient(135deg, #3B82F6, #2563EB)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: (!input.trim() || loading || disabled) ? 'not-allowed' : 'pointer'
          }}
        >
          Gửi
        </button>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      
      {/* Report Modal */}
      {showReportModal && opponentUserId && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={opponentUserId}
          matchId={matchId}
          onSuccess={() => {
            // Thêm message thông báo đã gửi báo cáo
            const successMsg: ChatMessage = {
              role: 'assistant',
              content: '✅ Đã gửi báo cáo thành công! Quản trị viên sẽ xem xét và xử lý.'
            }
            setLocalMessages(prev => [...prev, successMsg])
          }}
        />
      )}
    </div>
  )
}
