/**
 * OnlinePlayersPanel - Display online players in AI Analysis page
 * 
 * Features:
 * - Real-time online player list
 * - Search and filter controls
 * - Player context menu (Challenge, Message, View Profile)
 * - Count breakdown by rank tooltip
 * 
 * Requirements: 1.1-1.5, 2.1-2.4, 3.1-3.4, 4.1-4.3
 */

import React, { useState, useCallback, useMemo, memo } from 'react'
import { useOnlinePlayers, type OnlinePlayer } from '../../hooks/useOnlinePlayers'
import { useLanguage } from '../../contexts/LanguageContext'

interface OnlinePlayersPanelProps {
  currentUserId: string | null
  onChallenge?: (playerId: string) => void
  onMessage?: (playerId: string) => void
  onViewProfile?: (playerId: string) => void
}

interface PlayerContextMenuProps {
  player: OnlinePlayer
  position: { x: number; y: number }
  onClose: () => void
  onChallenge: () => void
  onMessage: () => void
  onViewProfile: () => void
}

// Rank badge colors
const RANK_COLORS: Record<string, string> = {
  vo_danh: '#64748B',
  tan_ky: '#22C55E',
  hoc_ky: '#3B82F6',
  ky_lao: '#8B5CF6',
  cao_ky: '#F59E0B',
  ky_thanh: '#EF4444',
  truyen_thuyet: '#EC4899'
}

// Player Context Menu Component
const PlayerContextMenu = memo(function PlayerContextMenu({
  player,
  position,
  onClose,
  onChallenge,
  onMessage,
  onViewProfile
}: PlayerContextMenuProps) {
  const { t } = useLanguage()

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999
        }}
        onClick={onClose}
      />
      {/* Menu */}
      <div
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid rgba(71,85,105,0.5)',
          borderRadius: 8,
          padding: 4,
          zIndex: 1000,
          minWidth: 140,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(71,85,105,0.3)', marginBottom: 4 }}>
          <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 13 }}>
            {player.display_name || player.username}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {t(`rank.${player.rank}`) || player.rank}
          </div>
        </div>
        <button
          onClick={() => { onViewProfile(); onClose() }}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: '#E2E8F0',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: 4
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          👤 {t('onlinePlayers.viewProfile') || 'Xem hồ sơ'}
        </button>
        <button
          onClick={() => { onChallenge(); onClose() }}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: '#E2E8F0',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: 4
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          ⚔️ {t('onlinePlayers.challenge') || 'Thách đấu'}
        </button>
        <button
          onClick={() => { onMessage(); onClose() }}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: '#E2E8F0',
            fontSize: 12,
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: 4
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56,189,248,0.15)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          💬 {t('onlinePlayers.message') || 'Nhắn tin'}
        </button>
      </div>
    </>
  )
})

// Player Card Component
const PlayerCard = memo(function PlayerCard({
  player,
  onClick
}: {
  player: OnlinePlayer
  onClick: (e: React.MouseEvent) => void
}) {
  const { t } = useLanguage()
  const rankColor = RANK_COLORS[player.rank] || RANK_COLORS.vo_danh

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 10px',
        background: 'rgba(30,41,59,0.5)',
        border: '1px solid rgba(71,85,105,0.3)',
        borderRadius: 8,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.15s'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(56,189,248,0.1)'
        e.currentTarget.style.borderColor = 'rgba(56,189,248,0.3)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(30,41,59,0.5)'
        e.currentTarget.style.borderColor = 'rgba(71,85,105,0.3)'
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative' }}>
        {player.avatar_url ? (
          <img
            src={player.avatar_url}
            alt=""
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              objectFit: 'cover',
              border: `2px solid ${rankColor}`
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: `2px solid ${rankColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#fff'
            }}
          >
            {(player.display_name || player.username || '?')[0].toUpperCase()}
          </div>
        )}
        {/* Online indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#22C55E',
            border: '2px solid #0F172A'
          }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 600,
          color: '#F1F5F9',
          fontSize: 13,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {player.display_name || player.username}
          {player.is_friend && (
            <span style={{ marginLeft: 4, fontSize: 10 }}>⭐</span>
          )}
        </div>
        <div style={{
          fontSize: 11,
          color: rankColor,
          fontWeight: 500
        }}>
          {t(`rank.${player.rank}`) || player.rank}
        </div>
      </div>

      {/* Mindpoint */}
      <div style={{
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: 500
      }}>
        {player.mindpoint} MP
      </div>
    </button>
  )
})

// Rank Count Tooltip
const RankCountTooltip = memo(function RankCountTooltip({
  countByRank,
  visible
}: {
  countByRank: Record<string, number>
  visible: boolean
}) {
  const { t } = useLanguage()

  if (!visible) return null

  const ranks = ['vo_danh', 'tan_ky', 'hoc_ky', 'ky_lao', 'cao_ky', 'ky_thanh', 'truyen_thuyet']

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 4,
        background: 'rgba(15,23,42,0.95)',
        border: '1px solid rgba(71,85,105,0.5)',
        borderRadius: 8,
        padding: 10,
        zIndex: 100,
        minWidth: 140,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}
    >
      {ranks.map(rank => {
        const count = countByRank[rank] || 0
        if (count === 0) return null
        return (
          <div
            key={rank}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              fontSize: 12
            }}
          >
            <span style={{ color: RANK_COLORS[rank] }}>
              {t(`rank.${rank}`) || rank}
            </span>
            <span style={{ color: '#94A3B8' }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
})

// Main Panel Component
export default function OnlinePlayersPanel({
  currentUserId,
  onChallenge,
  onMessage,
  onViewProfile
}: OnlinePlayersPanelProps) {
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [rankFilter, setRankFilter] = useState<string | null>(null)
  const [friendsOnly, setFriendsOnly] = useState(false)
  const [showRankTooltip, setShowRankTooltip] = useState(false)
  const [contextMenu, setContextMenu] = useState<{
    player: OnlinePlayer
    position: { x: number; y: number }
  } | null>(null)

  const { players, totalCount, countByRank, loading, error } = useOnlinePlayers({
    userId: currentUserId,
    friendsOnly,
    rankFilter,
    searchQuery,
    enabled: !!currentUserId
  })

  const handlePlayerClick = useCallback((player: OnlinePlayer, e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({
      player,
      position: { x: e.clientX, y: e.clientY }
    })
  }, [])

  const handleChallenge = useCallback(() => {
    if (contextMenu && onChallenge) {
      onChallenge(contextMenu.player.id)
    }
  }, [contextMenu, onChallenge])

  const handleMessage = useCallback(() => {
    if (contextMenu && onMessage) {
      onMessage(contextMenu.player.id)
    }
  }, [contextMenu, onMessage])

  const handleViewProfile = useCallback(() => {
    if (contextMenu && onViewProfile) {
      onViewProfile(contextMenu.player.id)
    }
  }, [contextMenu, onViewProfile])

  // Don't render if not authenticated
  if (!currentUserId) {
    return null
  }

  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.6)',
        borderRadius: 12,
        border: '1px solid rgba(71,85,105,0.35)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 400
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '1px solid rgba(71,85,105,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: 14 }}>
          🟢 {t('onlinePlayers.title') || 'Đang online'}
        </div>
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setShowRankTooltip(true)}
          onMouseLeave={() => setShowRankTooltip(false)}
        >
          <span
            style={{
              background: 'rgba(34,197,94,0.2)',
              color: '#22C55E',
              padding: '4px 10px',
              borderRadius: 12,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'default'
            }}
          >
            {totalCount}
          </span>
          <RankCountTooltip countByRank={countByRank} visible={showRankTooltip} />
        </div>
      </div>

      {/* Filters */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(71,85,105,0.35)' }}>
        {/* Search */}
        <input
          type="text"
          placeholder={t('onlinePlayers.searchPlaceholder') || 'Tìm người chơi...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(71,85,105,0.4)',
            background: 'rgba(30,41,59,0.5)',
            color: '#F1F5F9',
            fontSize: 12,
            marginBottom: 8
          }}
        />
        
        {/* Filter row */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            value={rankFilter || ''}
            onChange={e => setRankFilter(e.target.value || null)}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 6,
              border: '1px solid rgba(71,85,105,0.4)',
              background: 'rgba(30,41,59,0.5)',
              color: '#F1F5F9',
              fontSize: 11
            }}
          >
            <option value="">{t('onlinePlayers.allRanks') || 'Tất cả rank'}</option>
            <option value="vo_danh">{t('rank.vo_danh')}</option>
            <option value="tan_ky">{t('rank.tan_ky')}</option>
            <option value="hoc_ky">{t('rank.hoc_ky')}</option>
            <option value="ky_lao">{t('rank.ky_lao')}</option>
            <option value="cao_ky">{t('rank.cao_ky')}</option>
            <option value="ky_thanh">{t('rank.ky_thanh')}</option>
            <option value="truyen_thuyet">{t('rank.truyen_thuyet')}</option>
          </select>
          
          <button
            onClick={() => setFriendsOnly(!friendsOnly)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              border: friendsOnly ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(71,85,105,0.4)',
              background: friendsOnly ? 'rgba(56,189,248,0.15)' : 'rgba(30,41,59,0.5)',
              color: friendsOnly ? '#38BDF8' : '#94A3B8',
              fontSize: 11,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            ⭐ {t('onlinePlayers.friendsOnly') || 'Bạn bè'}
          </button>
        </div>
      </div>

      {/* Player List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#64748B', fontSize: 12 }}>
            {t('common.loading') || 'Đang tải...'}
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#F87171', fontSize: 12 }}>
            {t('onlinePlayers.error') || 'Lỗi kết nối'}
          </div>
        ) : players.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#64748B', fontSize: 12 }}>
            {searchQuery || rankFilter || friendsOnly
              ? (t('onlinePlayers.noMatch') || 'Không tìm thấy người chơi phù hợp')
              : (t('onlinePlayers.empty') || 'Chưa có ai online')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {players.map(player => (
              <PlayerCard
                key={player.id}
                player={player}
                onClick={e => handlePlayerClick(player, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <PlayerContextMenu
          player={contextMenu.player}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onChallenge={handleChallenge}
          onMessage={handleMessage}
          onViewProfile={handleViewProfile}
        />
      )}
    </div>
  )
}
