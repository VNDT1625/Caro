import React from 'react'
import './AvatarWithFrame.css'

export interface AvatarFrameData {
  id: string
  item_code: string
  preview_url?: string
  rarity?: 'common' | 'rare' | 'epic' | 'legendary'
  name?: string
}

interface AvatarWithFrameProps {
  avatarUrl?: string
  frame?: AvatarFrameData | null
  size?: number
  username?: string
  onClick?: () => void
  className?: string
  showGlow?: boolean
}

// Rarity gradient configs
const rarityGradients: Record<string, { border: string; glow: string; shadow: string }> = {
  common: {
    border: 'linear-gradient(135deg, #64748B 0%, #94A3B8 50%, #64748B 100%)',
    glow: 'rgba(148, 163, 184, 0.3)',
    shadow: '0 0 10px rgba(148, 163, 184, 0.3)'
  },
  rare: {
    border: 'linear-gradient(135deg, #1E40AF 0%, #3B82F6 25%, #60A5FA 50%, #3B82F6 75%, #1E40AF 100%)',
    glow: 'rgba(59, 130, 246, 0.5)',
    shadow: '0 0 15px rgba(59, 130, 246, 0.5), 0 0 30px rgba(59, 130, 246, 0.2)'
  },
  epic: {
    border: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 25%, #C084FC 50%, #A855F7 75%, #7C3AED 100%)',
    glow: 'rgba(168, 85, 247, 0.5)',
    shadow: '0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3)'
  },
  legendary: {
    border: 'conic-gradient(from 0deg, #F59E0B, #EF4444, #EC4899, #8B5CF6, #3B82F6, #10B981, #F59E0B)',
    glow: 'rgba(245, 158, 11, 0.6)',
    shadow: '0 0 25px rgba(245, 158, 11, 0.5), 0 0 50px rgba(239, 68, 68, 0.3), 0 0 75px rgba(168, 85, 247, 0.2)'
  }
}

export default function AvatarWithFrame({
  avatarUrl,
  frame,
  size = 48,
  username = '',
  onClick,
  className = '',
  showGlow = true
}: AvatarWithFrameProps) {
  const hasFrame = frame?.preview_url
  const rarity = frame?.rarity || 'common'
  const isCompact = className.includes('header-avatar') || className.includes('avatar-compact')

  // Nếu không có frame, render avatar đơn giản
  if (!hasFrame) {
    return (
      <div
        className={`avatar-with-frame ${className} no-frame`}
        style={{
          width: size,
          height: size,
          cursor: onClick ? 'pointer' : 'default',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '2px solid rgba(71, 85, 105, 0.4)',
          background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          flexShrink: 0
        }}
        onClick={onClick}
        title={username}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username || 'Avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            color: '#94A3B8'
          }}>
            👤
          </div>
        )}
      </div>
    )
  }

  // Frame styling based on rarity
  const frameStyle = rarityGradients[rarity] || rarityGradients.common
  const borderWidth = Math.max(3, Math.round(size * 0.06)) // 6% of size, min 3px
  const outerSize = size + borderWidth * 2 + 4 // Extra space for glow

  return (
    <div 
      className={`avatar-with-frame ${className} has-frame rarity-${rarity}`}
      style={{ 
        width: outerSize,
        height: outerSize,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}
      onClick={onClick}
      title={frame?.name || username}
    >
      {/* Outer glow effect */}
      <div 
        className={`frame-glow ${rarity === 'legendary' ? 'legendary-glow' : ''}`}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: frameStyle.border,
          boxShadow: frameStyle.shadow,
          opacity: rarity === 'legendary' ? 1 : 0.9
        }}
      />

      {/* Inner dark ring (creates depth) */}
      <div 
        style={{
          position: 'absolute',
          inset: borderWidth,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
        }}
      />

      {/* Avatar container */}
      <div 
        style={{ 
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 2,
          border: '2px solid rgba(30, 41, 59, 0.8)'
        }}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={username || 'Avatar'} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            color: '#94A3B8',
            background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)'
          }}>
            👤
          </div>
        )}
      </div>

      {/* Decorative corners/accents for epic+ frames */}
      {(rarity === 'epic' || rarity === 'legendary') && !isCompact && (
        <>
          <div className={`frame-accent accent-top ${rarity}`} />
          <div className={`frame-accent accent-bottom ${rarity}`} />
        </>
      )}

      {/* Custom frame image overlay - chỉ hiện nếu là PNG trong suốt */}
      {/* Tạm ẩn vì hầu hết frame images có nền không trong suốt */}
    </div>
  )
}

// Compact version for lists/small displays
export function AvatarWithFrameCompact({
  avatarUrl,
  frame,
  size = 32,
  username = '',
  onClick
}: Omit<AvatarWithFrameProps, 'showGlow' | 'className'>) {
  return (
    <AvatarWithFrame
      avatarUrl={avatarUrl}
      frame={frame}
      size={size}
      username={username}
      onClick={onClick}
      className="avatar-compact"
      showGlow={false}
    />
  )
}
