import type { ChatChannelScope, ChatMessage, ChatMessageType, SendChatResponse } from '../types/chat'
import { getApiBase } from './apiBase'

const API_BASE = getApiBase()

function buildUrl(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return API_BASE ? `${API_BASE}${normalized}` : normalized
}

export interface FetchChatHistoryParams {
  channel?: Exclude<ChatChannelScope, 'room'>
  roomId?: string | null
  limit?: number
  cursor?: string
  token?: string | null
}

export interface SendChatMessageParams {
  content: string
  messageType?: ChatMessageType
  roomId?: string | null
  channel?: Exclude<ChatChannelScope, 'room'>
  token?: string | null
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init)
  const text = await res.text()
  const json = text ? JSON.parse(text) : {}
  if (!res.ok) {
    const message = json?.error || json?.message || 'Chat API error'
    throw new Error(message)
  }
  return json as T
}

export async function fetchChatHistory(params: FetchChatHistoryParams): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const query = new URLSearchParams()
  if (params.channel) query.set('channel', params.channel)
  if (params.roomId) query.set('room_id', params.roomId)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.cursor) query.set('cursor', params.cursor)
  const search = query.toString()
  const url = buildUrl(`/api/chat/history${search ? `?${search}` : ''}`)
  return request<{ messages: ChatMessage[]; nextCursor: string | null }>(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
    }
  })
}

export async function sendChatMessage(params: SendChatMessageParams): Promise<SendChatResponse> {
  const url = buildUrl('/api/chat/send')
  const body: Record<string, unknown> = {
    content: params.content,
    message_type: params.messageType ?? 'text'
  }
  if (params.roomId) {
    body.room_id = params.roomId
  }
  if (params.channel) {
    body.channel = params.channel
  }
  return request<SendChatResponse>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(params.token ? { Authorization: `Bearer ${params.token}` } : {})
    },
    body: JSON.stringify(body)
  })
}
