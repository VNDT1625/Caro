export type ChatChannelScope = 'global' | 'friends' | 'room' | 'match'

export type ChatMessageType = 'text' | 'emote' | 'system' | 'sticker'

export interface ChatProfileSummary {
  display_name?: string | null
  username?: string | null
  avatar_url?: string | null
}

export interface ChatMessage {
  id: string
  sender_user_id: string
  target_user_id?: string | null
  room_id?: string | null
  match_id?: string | null
  message_type: ChatMessageType
  content: string
  channel_scope?: ChatChannelScope | null
  created_at: string
  sender_profile?: ChatProfileSummary | null
}

export interface SendChatResponse {
  message: ChatMessage
  truncated?: boolean
}
