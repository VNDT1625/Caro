import React, { useState, useRef, useEffect } from 'react'

interface EmotePickerProps {
  onEmoteSelect: (emote: string) => void
  position?: 'left' | 'right'
}

// Common emotes as Unicode or text (in real app, use GIF URLs)
const EMOTES = [
  { id: 'happy', emoji: '😊', name: 'Vui' },
  { id: 'laugh', emoji: '😂', name: 'Cười' },
  { id: 'cool', emoji: '😎', name: 'Ngầu' },
  { id: 'think', emoji: '🤔', name: 'Suy nghĩ' },
  { id: 'sweat', emoji: '😅', name: 'Hồi hộp' },
  { id: 'angry', emoji: '😠', name: 'Tức' },
  { id: 'cry', emoji: '😢', name: 'Khóc' },
  { id: 'love', emoji: '😍', name: 'Yêu' },
  { id: 'fire', emoji: '🔥', name: 'Bùng nổ' },
  { id: 'star', emoji: '⭐', name: 'Tuyệt vời' },
  { id: 'clap', emoji: '👏', name: 'Vỗ tay' },
  { id: 'thumbup', emoji: '👍', name: 'Hay' },
  { id: 'thumbdown', emoji: '👎', name: 'Tệ' },
  { id: 'peace', emoji: '✌️', name: 'Hòa bình' },
  { id: 'muscle', emoji: '💪', name: 'Mạnh' },
  { id: 'brain', emoji: '🧠', name: 'Thông minh' },
  { id: 'zzz', emoji: '😴', name: 'Buồn ngủ' },
  { id: 'dizzy', emoji: '😵', name: 'Choáng' },
]

export default function EmotePicker({ onEmoteSelect, position = 'left' }: EmotePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleEmoteClick = (emote: string) => {
    onEmoteSelect(emote)
    setIsOpen(false)
  }

  return (
    <div ref={pickerRef} style={{ position: 'relative' }}>
      {/* Emote button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.3)',
          background: 'rgba(0,0,0,0.5)',
          cursor: 'pointer',
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.borderColor = 'rgba(255,215,0,0.6)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
        }}
        title="Biểu cảm"
      >
        😊
      </button>

      {/* Emote picker popup */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            [position === 'left' ? 'left' : 'right']: '0',
            bottom: '45px',
            background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
            border: '2px solid rgba(255,215,0,0.3)',
            borderRadius: '12px',
            padding: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '8px',
            width: '220px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            zIndex: 1000,
            animation: 'emotePopIn 0.2s ease'
          }}
        >
          <div style={{
            gridColumn: '1 / -1',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            marginBottom: '4px',
            textAlign: 'center',
            fontWeight: 'bold'
          }}>
            Chọn biểu cảm
          </div>
          
          {EMOTES.map((emote) => (
            <button
              key={emote.id}
              onClick={() => handleEmoteClick(emote.emoji)}
              style={{
                width: '32px',
                height: '32px',
                fontSize: '20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,215,0,0.3)'
                e.currentTarget.style.transform = 'scale(1.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                e.currentTarget.style.transform = 'scale(1)'
              }}
              title={emote.name}
            >
              {emote.emoji}
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes emotePopIn {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
